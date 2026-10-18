import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { ShoppingBasket, Star } from "lucide-react";
import QuantitySelector from "../components/QuantitySelector";
import type { Product } from "../components/MyProductList";
import { useLanguage } from "../i18n/useLanguage";
import { supabaseService, type ProductDeliveryDetails, type ProductReview } from "../services/supabase/service";
import { formatCartAmount } from "./cartUtils";
import "./ProductsDetailsView.css";

type ProductsDetailsViewProps = {
	product: Product;
	currentUser: User | null;
	onAddToCart: (product: Product, quantity: number) => void;
	onSelectProduct: (product: Product) => void;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function ProductsDetailsView({ product, currentUser, onAddToCart, onSelectProduct }: ProductsDetailsViewProps) {
	const { language, t } = useLanguage();
	const [quantity, setQuantity] = useState(1);
	const [reviews, setReviews] = useState<ProductReview[]>([]);
	const [delivery, setDelivery] = useState<ProductDeliveryDetails | null>(null);
	const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
	const [whatsAppPhone, setWhatsAppPhone] = useState("");
	const [canReview, setCanReview] = useState(false);
	const [reviewEligibilityChecked, setReviewEligibilityChecked] = useState(false);
	const [reviewEligibilityFailed, setReviewEligibilityFailed] = useState(false);
	const [reviewName, setReviewName] = useState(
		(typeof currentUser?.user_metadata?.username === "string" && currentUser.user_metadata.username) ||
		currentUser?.email?.split("@")[0] ||
		"",
	);
	const [reviewText, setReviewText] = useState("");
	const [reviewRating, setReviewRating] = useState(5);
	const [reviewPhoto, setReviewPhoto] = useState<File | undefined>();
	const [isSubmittingReview, setIsSubmittingReview] = useState(false);
	const [reviewError, setReviewError] = useState("");
	const [reviewMessage, setReviewMessage] = useState("");
	const [detailsError, setDetailsError] = useState("");
	const [whatsAppUnavailable, setWhatsAppUnavailable] = useState(false);
	const photoInputRef = useRef<HTMLInputElement>(null);
	const name = product.name ?? product.title ?? product.product_name ?? t("unnamedProduct");
	const imageUrl = product.image_url ?? product.image;
	const price = Number(product.price);
	const priceLocale = language === "fr" ? "fr-HT" : "ht-HT";
	const productId = typeof product.id === "string" && uuidPattern.test(product.id) ? product.id : null;

	useEffect(() => {
		let isMounted = true;
		setDetailsError("");
		setReviews([]);
		setDelivery(null);
		setRelatedProducts([]);
		setQuantity(1);
		if (!productId) return () => { isMounted = false; };

		void Promise.all([
			supabaseService.getProductReviews(productId),
			supabaseService.getProductDeliveryDetails(productId),
			product.category_id
				? supabaseService.getRelatedProducts(product.category_id, productId, 4)
				: Promise.resolve({ data: [], error: null }),
		]).then(([loadedReviews, loadedDelivery, relatedResult]) => {
			if (!isMounted) return;
			if (relatedResult.error) throw relatedResult.error;
			setReviews(loadedReviews);
			setDelivery(loadedDelivery);
			setRelatedProducts((relatedResult.data ?? []) as Product[]);
		}).catch((error: unknown) => {
			if (isMounted) {
				console.error("Unable to load product details:", error);
				setDetailsError(t("reviewsLoadError"));
			}
		});

		return () => { isMounted = false; };
	}, [productId, product.category_id, t]);

	useEffect(() => {
		let isMounted = true;
		if (!currentUser) {
			setWhatsAppPhone("");
			setCanReview(false);
			setReviewEligibilityChecked(false);
			setReviewEligibilityFailed(false);
			setWhatsAppUnavailable(false);
			return () => { isMounted = false; };
		}

		setReviewEligibilityChecked(false);
		setReviewEligibilityFailed(false);
		setWhatsAppUnavailable(false);
		void Promise.allSettled([
			supabaseService.getCustomerWhatsAppPhone(),
			productId ? supabaseService.canCustomerReviewProduct(productId) : Promise.resolve(false),
		]).then(([phoneResult, eligibilityResult]) => {
			if (isMounted) {
				if (phoneResult.status === "fulfilled") {
					setWhatsAppPhone(phoneResult.value);
				} else {
					setWhatsAppPhone("");
					setWhatsAppUnavailable(true);
					console.error("Unable to load the signed-in WhatsApp contact:", phoneResult.reason);
				}
				if (eligibilityResult.status === "fulfilled") {
					setCanReview(eligibilityResult.value);
				} else {
					setCanReview(false);
					setReviewEligibilityFailed(true);
					console.error("Unable to check product review eligibility:", eligibilityResult.reason);
				}
				setReviewEligibilityChecked(true);
			}
		});

		return () => { isMounted = false; };
	}, [currentUser, productId]);

	const submitReview = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!productId) return;
		setIsSubmittingReview(true);
		setReviewError("");
		setReviewMessage("");
		try {
			await supabaseService.submitProductReview(productId, reviewName, reviewRating, reviewText, reviewPhoto);
			setReviews(await supabaseService.getProductReviews(productId));
			setReviewText("");
			setReviewPhoto(undefined);
			if (photoInputRef.current) photoInputRef.current.value = "";
			setCanReview(false);
			setReviewMessage(t("reviewPublished"));
		} catch (error: unknown) {
			setReviewError(error instanceof Error ? error.message : t("reviewSubmitError"));
		} finally {
			setIsSubmittingReview(false);
		}
	};

	return (
		<main className="product-details">
			<article className="product-details__card">
				<div className="product-details__media">
					{imageUrl && <img src={imageUrl} alt={name} />}
				</div>
				<div className="product-details__content">
					<h1>{name}</h1>
					{product.price !== undefined && Number.isFinite(price) && (
						<p className="product-details__price">{formatCartAmount(price, priceLocale)}</p>
					)}
					{product.description && <p className="product-details__description">{product.description}</p>}
					{product.what_it_does && <section className="product-details__fact"><h2>{t("productWhatItDoes")}</h2><p>{product.what_it_does}</p></section>}
					{product.how_to_use && <section className="product-details__fact"><h2>{t("productHowToUse")}</h2><p>{product.how_to_use}</p></section>}
					{product.ingredients && <section className="product-details__fact"><h2>{t("productIngredients")}</h2><p>{product.ingredients}</p></section>}
					{product.suitable_for && <section className="product-details__fact"><h2>{t("productSuitableFor")}</h2><p>{product.suitable_for}</p></section>}
					<section className="product-details__delivery">
						<h2>{t("productDelivery")}</h2>
						{delivery ? (
							<>
								<p>{t("deliveryDaysRange").replace("{min}", String(delivery.min_delivery_days)).replace("{max}", String(delivery.max_delivery_days))} {delivery.day_type === "business" ? t("businessDays") : t("calendarDays")}</p>
								<p>{t("deliveryFee")}: {formatCartAmount(Number(delivery.delivery_fee), priceLocale)} ({t("deliveryFeeNotIncluded")})</p>
								{delivery.delivery_notes && <p>{delivery.delivery_notes}</p>}
							</>
						) : <p>{t("contactForDelivery")}</p>}
					</section>
					<QuantitySelector
						quantity={quantity}
						onChange={setQuantity}
						label={t("quantity")}
						decreaseLabel={t("decreaseQuantity")}
						increaseLabel={t("increaseQuantity")}
					/>
					<button
						className="add-to-cart-button product-details__add-to-cart"
						type="button"
						onClick={() => onAddToCart(product, quantity)}
					>
						<ShoppingBasket aria-hidden="true" />
						{t("addToCart")}
					</button>
					{currentUser && (whatsAppPhone
						? <a className="product-details__whatsapp" href={`https://wa.me/${whatsAppPhone}`} target="_blank" rel="noreferrer">{t("askOnWhatsApp")}</a>
						: whatsAppUnavailable && <p className="product-details__inline-error">{t("whatsAppUnavailable")}</p>)}
				</div>
			</article>
			<section className="product-details__reviews" aria-labelledby="product-reviews-title">
				<h2 id="product-reviews-title">{t("productReviews")}</h2>
				{detailsError && <p className="product-details__inline-error" role="alert">{detailsError}</p>}
				{reviews.length === 0 && !detailsError && <p>{t("noProductReviews")}</p>}
				<ul className="product-details__review-list">
					{reviews.map((review) => (
						<li key={review.id}>
							<p className="product-details__review-rating" aria-label={`${review.rating} / 5`}>
								{Array.from({ length: 5 }, (_, index) => <Star key={index} aria-hidden="true" fill={index < review.rating ? "currentColor" : "none"} />)}
								<strong>{review.display_name} · {t("verifiedBuyerLabel")}</strong>
							</p>
							<p>{review.review_text}</p>
							{review.photo_url && <img src={review.photo_url} alt={`${t("reviewVerifiedBuyer")}: ${review.display_name}`} loading="lazy" />}
						</li>
					))}
				</ul>
				{currentUser && canReview && (
					<form className="product-details__review-form" onSubmit={(event) => void submitReview(event)}>
						<h3>{t("writeProductReview")}</h3>
						<label>{t("reviewName")}<input required maxLength={60} value={reviewName} onChange={(event) => setReviewName(event.target.value)} /></label>
						<label>{t("reviewRating")}<select value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))}>
							{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}
						</select></label>
						<label>{t("reviewText")}<textarea required maxLength={1000} rows={4} value={reviewText} onChange={(event) => setReviewText(event.target.value)} /></label>
						<label>{t("reviewPhoto")}<input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setReviewPhoto(event.target.files?.[0])} /></label>
						{reviewError && <p className="product-details__inline-error" role="alert">{reviewError}</p>}
						{reviewMessage && <p role="status">{reviewMessage}</p>}
						<button className="add-to-cart-button" type="submit" disabled={isSubmittingReview}>{isSubmittingReview ? t("reviewSubmitting") : t("submitReview")}</button>
					</form>
				)}
				{currentUser && reviewEligibilityChecked && !canReview && reviews.length === 0 && <p>{reviewEligibilityFailed ? t("reviewEligibilityError") : t("reviewNotEligible")}</p>}
			</section>
			{relatedProducts.length > 0 && (
				<section className="product-details__related" aria-labelledby="related-products-title">
					<h2 id="related-products-title">{t("relatedProducts")}</h2>
					<div className="product-details__related-grid">
						{relatedProducts.map((related) => {
							const relatedName = related.name ?? related.title ?? related.product_name ?? t("unnamedProduct");
							const relatedPrice = Number(related.price);
							return (
								<button key={String(related.id)} type="button" onClick={() => onSelectProduct(related)}>
									{(related.image_url ?? related.image) && <img src={related.image_url ?? related.image} alt="" loading="lazy" />}
									<strong>{relatedName}</strong>
									{Number.isFinite(relatedPrice) && <span>{formatCartAmount(relatedPrice, priceLocale)}</span>}
								</button>
							);
						})}
					</div>
				</section>
			)}
		</main>
	);
}
