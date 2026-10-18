import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabaseService, type AdminProduct, type ProductCategory, type ProductDeliveryDetails, type ProductReview } from "../services/supabase/service";
import { useLanguage } from "../i18n/useLanguage";
import "./AdminView.css";

function emptyProduct(): Omit<AdminProduct, "id"> & { id?: string } {
	return {
		category_id: null,
		name: "",
		description: "",
		what_it_does: "",
		how_to_use: "",
		ingredients: "",
		suitable_for: "",
		price: 0,
		image_url: "",
		is_active: true,
	};
}

function emptyDelivery(productId: string): ProductDeliveryDetails {
	return {
		product_id: productId,
		min_delivery_days: 1,
		max_delivery_days: 3,
		day_type: "business",
		delivery_fee: 0,
		delivery_notes: "",
	};
}

export default function AdminView() {
	const { t } = useLanguage();
	const [isChecking, setIsChecking] = useState(true);
	const [isAdmin, setIsAdmin] = useState(false);
	const [products, setProducts] = useState<AdminProduct[]>([]);
	const [categories, setCategories] = useState<ProductCategory[]>([]);
	const [deliveryDetails, setDeliveryDetails] = useState<ProductDeliveryDetails[]>([]);
	const [reviews, setReviews] = useState<ProductReview[]>([]);
	const [whatsAppPhone, setWhatsAppPhone] = useState("");
	const [productForm, setProductForm] = useState(emptyProduct);
	const [selectedDeliveryProductId, setSelectedDeliveryProductId] = useState("");
	const [deliveryForm, setDeliveryForm] = useState<ProductDeliveryDetails | null>(null);
	const [newCategory, setNewCategory] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [message, setMessage] = useState("");
	const [errorMessage, setErrorMessage] = useState("");

	const loadAdminData = useCallback(async () => {
		setErrorMessage("");
		const allowed = await supabaseService.isStoreAdmin();
		setIsAdmin(allowed);
		if (!allowed) return;

		const [loadedProducts, loadedCategories, loadedDelivery, loadedPhone, loadedReviews] = await Promise.all([
			supabaseService.getAdminProducts(),
			supabaseService.getAdminCategories(),
			supabaseService.getAdminDeliveryDetails(),
			supabaseService.getAdminWhatsAppPhone(),
			supabaseService.getAdminReviews(),
		]);
		setProducts(loadedProducts);
		setCategories(loadedCategories);
		setDeliveryDetails(loadedDelivery);
		setWhatsAppPhone(loadedPhone);
		setReviews(loadedReviews);
	}, []);

	useEffect(() => {
		let isMounted = true;
		void loadAdminData()
			.catch((error: unknown) => {
				if (isMounted) setErrorMessage(error instanceof Error ? error.message : t("adminSaveError"));
			})
			.finally(() => {
				if (isMounted) setIsChecking(false);
			});
		return () => {
			isMounted = false;
		};
	}, [loadAdminData, t]);

	useEffect(() => {
		if (!selectedDeliveryProductId) {
			setDeliveryForm(null);
			return;
		}
		setDeliveryForm(
			deliveryDetails.find(({ product_id }) => product_id === selectedDeliveryProductId) ??
			emptyDelivery(selectedDeliveryProductId),
		);
	}, [deliveryDetails, selectedDeliveryProductId]);

	const runAdminAction = async (action: () => Promise<void>, successMessage: string) => {
		setErrorMessage("");
		setMessage("");
		setIsSaving(true);
		try {
			await action();
			await loadAdminData();
			setMessage(successMessage);
		} catch (error: unknown) {
			setErrorMessage(error instanceof Error ? error.message : t("adminSaveError"));
		} finally {
			setIsSaving(false);
		}
	};

	const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		await runAdminAction(async () => {
			await supabaseService.saveAdminProduct(productForm);
			setProductForm(emptyProduct());
		}, t("adminProductSaved"));
	};

	const saveDelivery = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!deliveryForm) return;
		await runAdminAction(() => supabaseService.saveAdminDeliveryDetails(deliveryForm), t("adminProductSaved"));
	};

	const saveWhatsApp = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		await runAdminAction(() => supabaseService.saveAdminWhatsAppPhone(whatsAppPhone), t("adminProductSaved"));
	};

	const addCategory = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		await runAdminAction(async () => {
			await supabaseService.saveAdminCategory(newCategory);
			setNewCategory("");
		}, t("adminProductSaved"));
	};

	const toggleProduct = async (product: AdminProduct) => {
		await runAdminAction(
			() => supabaseService.saveAdminProduct({ ...product, is_active: !product.is_active }),
			t("adminProductSaved"),
		);
	};

	const deleteReview = async (review: ProductReview) => {
		if (!window.confirm(t("adminConfirmDeleteReview"))) return;
		await runAdminAction(() => supabaseService.deleteAdminReview(review), t("adminProductSaved"));
	};

	if (isChecking) {
		return <main className="admin-view"><p role="status">{t("adminLoading")}</p></main>;
	}

	if (!isAdmin) {
		return <main className="admin-view"><p className="admin-view__error" role="alert">{t("adminAccessDenied")}</p></main>;
	}

	return (
		<main className="admin-view">
			<header className="admin-view__header">
				<h1>{t("adminTitle")}</h1>
				<p>{t("adminPageDescription")}</p>
			</header>
			{errorMessage && <p className="admin-view__error" role="alert">{errorMessage}</p>}
			{message && <p className="admin-view__success" role="status">{message}</p>}

			<section className="admin-view__panel">
				<h2>{productForm.id ? t("adminEditProduct") : t("adminAddProduct")}</h2>
				<form className="admin-view__form" onSubmit={(event) => void saveProduct(event)}>
					<label>{t("adminProductName")}<input required maxLength={200} value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} /></label>
					<label>{t("adminCategory")}
						<select value={productForm.category_id ?? ""} onChange={(event) => setProductForm({ ...productForm, category_id: event.target.value || null })}>
							<option value="">—</option>
							{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
						</select>
					</label>
					<label>{t("adminDescription")}<textarea rows={3} value={productForm.description ?? ""} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} /></label>
					<label>{t("adminWhatItDoes")}<textarea rows={2} value={productForm.what_it_does ?? ""} onChange={(event) => setProductForm({ ...productForm, what_it_does: event.target.value })} /></label>
					<label>{t("adminHowToUse")}<textarea rows={2} value={productForm.how_to_use ?? ""} onChange={(event) => setProductForm({ ...productForm, how_to_use: event.target.value })} /></label>
					<label>{t("adminIngredients")}<textarea rows={2} value={productForm.ingredients ?? ""} onChange={(event) => setProductForm({ ...productForm, ingredients: event.target.value })} /></label>
					<label>{t("adminSuitableFor")}<textarea rows={2} value={productForm.suitable_for ?? ""} onChange={(event) => setProductForm({ ...productForm, suitable_for: event.target.value })} /></label>
					<label>{t("adminPrice")}<input type="number" min="0" step="0.01" required value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} /></label>
					<label>{t("adminImageUrl")}<input type="url" value={productForm.image_url ?? ""} onChange={(event) => setProductForm({ ...productForm, image_url: event.target.value })} /></label>
					<label className="admin-view__checkbox"><input type="checkbox" checked={productForm.is_active} onChange={(event) => setProductForm({ ...productForm, is_active: event.target.checked })} />{t("adminActive")}</label>
					<button className="add-to-cart-button" type="submit" disabled={isSaving}>{t("adminSaveProduct")}</button>
					{productForm.id && <button type="button" onClick={() => setProductForm(emptyProduct())}>{t("cancel")}</button>}
				</form>
				<form className="admin-view__category-form" onSubmit={(event) => void addCategory(event)}>
					<label>{t("adminNewCategory")}<input required maxLength={100} value={newCategory} onChange={(event) => setNewCategory(event.target.value)} /></label>
					<button type="submit" disabled={isSaving}>{t("adminAddCategory")}</button>
				</form>
				<p className="admin-view__hint">{t("adminDeactivateHint")}</p>
				<ul className="admin-view__product-list">
					{products.map((product) => (
						<li key={product.id}>
							<span>{product.name} {!product.is_active && <small>({t("adminInactiveProduct")})</small>}</span>
							<div>
								<button type="button" onClick={() => setProductForm({ ...product })}>{t("adminEditProduct")}</button>
								<button type="button" disabled={isSaving} onClick={() => void toggleProduct(product)}>{product.is_active ? t("adminDisableProduct") : t("adminEnableProduct")}</button>
							</div>
						</li>
					))}
				</ul>
			</section>

			<section className="admin-view__panel">
				<h2>{t("adminDeliveryFor")}</h2>
				<p>{t("adminDeliveryFeeHint")}</p>
				<label>{t("adminProducts")}
					<select value={selectedDeliveryProductId} onChange={(event) => setSelectedDeliveryProductId(event.target.value)}>
						<option value="">—</option>
						{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
					</select>
				</label>
				{deliveryForm && (
					<form className="admin-view__form" onSubmit={(event) => void saveDelivery(event)}>
						<label>{t("adminMinDays")}<input type="number" min="1" step="1" required value={deliveryForm.min_delivery_days} onChange={(event) => setDeliveryForm({ ...deliveryForm, min_delivery_days: Number(event.target.value) })} /></label>
						<label>{t("adminMaxDays")}<input type="number" min="1" step="1" required value={deliveryForm.max_delivery_days} onChange={(event) => setDeliveryForm({ ...deliveryForm, max_delivery_days: Number(event.target.value) })} /></label>
						<label>{t("adminDayType")}
							<select value={deliveryForm.day_type} onChange={(event) => setDeliveryForm({ ...deliveryForm, day_type: event.target.value as "business" | "calendar" })}>
								<option value="business">{t("adminBusinessDays")}</option>
								<option value="calendar">{t("adminCalendarDays")}</option>
							</select>
						</label>
						<label>{t("adminDeliveryFee")}<input type="number" min="0" step="0.01" required value={deliveryForm.delivery_fee} onChange={(event) => setDeliveryForm({ ...deliveryForm, delivery_fee: event.target.value })} /></label>
						<label>{t("adminDeliveryNotes")}<textarea maxLength={500} rows={3} value={deliveryForm.delivery_notes ?? ""} onChange={(event) => setDeliveryForm({ ...deliveryForm, delivery_notes: event.target.value })} /></label>
						<button className="add-to-cart-button" type="submit" disabled={isSaving}>{t("adminSaveDelivery")}</button>
					</form>
				)}
			</section>

			<section className="admin-view__panel">
				<h2>{t("adminWhatsApp")}</h2>
				<p>{t("adminWhatsAppHint")}</p>
				<form className="admin-view__category-form" onSubmit={(event) => void saveWhatsApp(event)}>
					<label>{t("adminWhatsApp")}<input type="tel" autoComplete="tel" required value={whatsAppPhone} onChange={(event) => setWhatsAppPhone(event.target.value)} /></label>
					<button type="submit" disabled={isSaving}>{t("adminSaveWhatsApp")}</button>
				</form>
			</section>

			<section className="admin-view__panel">
				<h2>{t("adminReviews")}</h2>
				{reviews.length === 0 ? <p>{t("noProductReviews")}</p> : (
					<ul className="admin-view__reviews">
						{reviews.map((review) => (
							<li key={review.id}>
								<div><strong>{review.display_name}</strong> · {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}<p>{review.review_text}</p>
									{review.photo_url && <img src={review.photo_url} alt={review.display_name} />}
								</div>
								<button type="button" disabled={isSaving} onClick={() => void deleteReview(review)}>{t("adminDeleteReview")}</button>
							</li>
						))}
					</ul>
				)}
			</section>
		</main>
	);
}
