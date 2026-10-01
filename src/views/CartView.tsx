import { ArrowLeft, ShoppingBasket, Trash2 } from "lucide-react";
import QuantitySelector from "../components/QuantitySelector";
import type { Product } from "../components/MyProductList";
import { useLanguage } from "../i18n/useLanguage";
import { formatCartAmount, getCartSubtotal } from "./cartUtils";
import "./cartView.css";

export type CartItem = {
	key: string;
	product: Product;
	quantity: number;
};

type CartViewProps = {
	items: CartItem[];
	isLoading: boolean;
	onQuantityChange: (key: string, quantity: number) => void;
	onRemove: (key: string) => void;
	onContinueShopping: () => void;
	onCheckout: () => void;
};

export default function CartView({
	items,
	isLoading,
	onQuantityChange,
	onRemove,
	onContinueShopping,
	onCheckout,
}: CartViewProps) {
	const { language, t } = useLanguage();
	const priceLocale = language === "fr" ? "fr-HT" : "ht-HT";
	const subtotal = getCartSubtotal(items);
	const formattedSubtotal = subtotal === null
		? t("priceUnavailable")
		: formatCartAmount(subtotal, language === "fr" ? "fr-FR" : "ht-HT");

	return (
		<main className="cart-view">
			<button
				className="cart-view__continue"
				type="button"
				onClick={onContinueShopping}
			>
				<ArrowLeft aria-hidden="true" />
				{t("continueShopping")}
			</button>
			<h1 className="cart-view__title">{t("shoppingBasket")}</h1>
			{isLoading ? (
				<p className="cart-view__loading" role="status">{t("cartLoading")}</p>
			) : items.length === 0 ? (
				<section className="cart-view__empty">
					<ShoppingBasket aria-hidden="true" />
					<p>{t("cartEmpty")}</p>
				</section>
			) : (
				<>
					<ul className="cart-view__items">
						{items.map(({ key, product, quantity }) => {
							const name = product.name ?? product.title ?? product.product_name ?? t("unnamedProduct");
							const imageUrl = product.image_url ?? product.image;

							return (
								<li className="cart-view__item" key={key}>
									<div className="cart-view__image">
										{imageUrl && <img src={imageUrl} alt="" />}
									</div>
									<div className="cart-view__item-info">
										<h2>{name}</h2>
										{product.price !== undefined && (
											<p className="cart-view__price">
												{formatCartAmount(Number(product.price), priceLocale)}
											</p>
										)}
										{product.price !== undefined && Number.isFinite(Number(product.price)) && (
											<p className="cart-view__line-total">
												{t("lineTotal")}: {formatCartAmount(Number(product.price) * quantity, priceLocale)}
											</p>
										)}
									</div>
									<div className="cart-view__item-actions">
										<QuantitySelector
											quantity={quantity}
											onChange={(nextQuantity) => onQuantityChange(key, nextQuantity)}
											label={`${t("quantity")}: ${name}`}
											decreaseLabel={`${t("decreaseQuantity")}: ${name}`}
											increaseLabel={`${t("increaseQuantity")}: ${name}`}
											minimum={0}
										/>
										<button
											className="cart-view__remove"
											type="button"
											aria-label={`${t("removeFromCart")}: ${name}`}
											onClick={() => onRemove(key)}
										>
											<Trash2 aria-hidden="true" />
										</button>
									</div>
								</li>
							);
						})}
					</ul>
					<section className="cart-view__summary" aria-label={t("orderSummary")}>
						<p className="cart-view__subtotal">
							<span>{t("subtotal")}</span>
							<strong>{formattedSubtotal}</strong>
						</p>
						<p className="cart-view__summary-note">{t("checkoutTotalNote")}</p>
						<button
							className="add-to-cart-button cart-view__checkout"
							type="button"
							onClick={onCheckout}
							disabled={subtotal === null}
						>
							{t("checkout")}
						</button>
					</section>
				</>
			)}
		</main>
	);
}