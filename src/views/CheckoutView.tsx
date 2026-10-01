import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import type { CartItem } from "./CartView";
import { useLanguage } from "../i18n/useLanguage";
import { formatCartAmount, getCartSubtotal } from "./cartUtils";
import "./CheckoutView.css";

type CheckoutViewProps = {
	items: CartItem[];
	onBackToCart: () => void;
	onStartPayment: () => Promise<void>;
};

export default function CheckoutView({ items, onBackToCart, onStartPayment }: CheckoutViewProps) {
	const { language, t } = useLanguage();
	const [errorMessage, setErrorMessage] = useState("");
	const [isStartingPayment, setIsStartingPayment] = useState(false);
	const priceLocale = language === "fr" ? "fr-HT" : "ht-HT";
	const subtotal = getCartSubtotal(items);
	const formattedSubtotal = subtotal === null
		? t("priceUnavailable")
		: formatCartAmount(subtotal, priceLocale);

	const handleStartPayment = async () => {
		setErrorMessage("");
		setIsStartingPayment(true);
		try {
			await onStartPayment();
		} catch (error: unknown) {
			setErrorMessage(error instanceof Error ? error.message : t("unableToStartPayment"));
			setIsStartingPayment(false);
		}
	};

	return (
		<main className="checkout-view">
			<button className="checkout-view__back" type="button" onClick={onBackToCart}>
				<ArrowLeft aria-hidden="true" />
				{t("backToCart")}
			</button>
			<section className="checkout-view__panel">
				<p className="checkout-view__eyebrow">{t("shoppingBasket")}</p>
				<h1>{t("checkoutTitle")}</h1>
				<p className="checkout-view__description">{t("checkoutDescription")}</p>
				<ul className="checkout-view__items">
					{items.map(({ key, product, quantity }) => {
						const name = product.name ?? product.title ?? product.product_name ?? t("unnamedProduct");
						const price = Number(product.price);
						const lineTotal = Number.isFinite(price) && price >= 0
							? formatCartAmount(price * quantity, priceLocale)
							: t("priceUnavailable");

						return (
							<li key={key}>
								<span>{name} × {quantity}</span>
								<strong>{lineTotal}</strong>
							</li>
						);
					})}
				</ul>
				<p className="checkout-view__total">
					<span>{t("subtotal")}</span>
					<strong>{formattedSubtotal}</strong>
				</p>
				<p className="checkout-view__note">{t("checkoutTotalNote")}</p>
				{errorMessage && <p className="checkout-view__error" role="alert">{errorMessage}</p>}
				<button
					className="add-to-cart-button checkout-view__pay"
					type="button"
					onClick={() => void handleStartPayment()}
					disabled={isStartingPayment || subtotal === null || items.length === 0}
				>
					{isStartingPayment ? t("startingPayment") : t("payWithMonCash")}
				</button>
			</section>
		</main>
	);
}
