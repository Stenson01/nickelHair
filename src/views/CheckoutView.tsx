import { useState, type FormEvent } from "react";
import type { CartItem } from "./CartView";
import { useLanguage } from "../i18n/useLanguage";
import { formatCartAmount, getCartSubtotal } from "./cartUtils";
import type { CashOnDeliveryDetails } from "../services/supabase/service";
import "./CheckoutView.css";

type CheckoutViewProps = {
	items: CartItem[];
	onPlaceCashOnDeliveryOrder: (details: CashOnDeliveryDetails) => Promise<string>;
	onContinueShopping: () => void;
};

export default function CheckoutView({
	items,
	onPlaceCashOnDeliveryOrder,
	onContinueShopping,
}: CheckoutViewProps) {
	const { language, t } = useLanguage();
	const [errorMessage, setErrorMessage] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [deliveryName, setDeliveryName] = useState("");
	const [deliveryPhone, setDeliveryPhone] = useState("");
	const [deliveryAddress, setDeliveryAddress] = useState("");
	const [confirmedOrderId, setConfirmedOrderId] = useState("");
	const priceLocale = language === "fr" ? "fr-HT" : "ht-HT";
	const subtotal = getCartSubtotal(items);
	const formattedSubtotal = subtotal === null
		? t("priceUnavailable")
		: formatCartAmount(subtotal, priceLocale);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setErrorMessage("");
		setIsSubmitting(true);
		try {
			const orderId = await onPlaceCashOnDeliveryOrder({
				name: deliveryName.trim(),
				phone: deliveryPhone.trim(),
				address: deliveryAddress.trim(),
			});
			setConfirmedOrderId(orderId);
		} catch (error: unknown) {
			setErrorMessage(error instanceof Error ? error.message : t("unableToPlaceOrder"));
			setIsSubmitting(false);
		}
	};

	if (confirmedOrderId) {
		return (
			<main className="checkout-view">
				<section className="checkout-view__panel" aria-live="polite">
					<p className="checkout-view__eyebrow">{t("orderConfirmed")}</p>
					<h1>{t("cashOrderConfirmedTitle")}</h1>
					<p className="checkout-view__description">{t("cashOrderConfirmedDescription")}</p>
					<p className="checkout-view__order-id">
						<span>{t("orderNumber")}</span>
						<strong>{confirmedOrderId}</strong>
					</p>
					<p className="checkout-view__total">
						<span>{t("amountDueOnDelivery")}</span>
						<strong>{formattedSubtotal}</strong>
					</p>
					<button
						className="add-to-cart-button checkout-view__pay"
						type="button"
						onClick={onContinueShopping}
					>
						{t("continueShopping")}
					</button>
				</section>
			</main>
		);
	}

	return (
		<main className="checkout-view">
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
				<form onSubmit={(event) => void handleSubmit(event)}>
					<fieldset className="checkout-view__delivery-details">
						<legend>{t("deliveryDetails")}</legend>
						<label>
							{t("deliveryName")}
							<input
								autoComplete="name"
								maxLength={120}
								required
								value={deliveryName}
								onChange={(event) => setDeliveryName(event.target.value)}
							/>
						</label>
						<label>
							{t("deliveryPhone")}
							<input
								autoComplete="tel"
								type="tel"
								maxLength={40}
								required
								value={deliveryPhone}
								onChange={(event) => setDeliveryPhone(event.target.value)}
							/>
						</label>
						<label>
							{t("deliveryAddress")}
							<textarea
								autoComplete="street-address"
								maxLength={500}
								required
								rows={3}
								value={deliveryAddress}
								onChange={(event) => setDeliveryAddress(event.target.value)}
							/>
						</label>
					</fieldset>
					<button
						className="add-to-cart-button checkout-view__pay"
						type="submit"
						disabled={isSubmitting || subtotal === null || items.length === 0}
					>
						{isSubmitting ? t("placingOrder") : t("placeCashOrder")}
					</button>
				</form>
			</section>
		</main>
	);
}
