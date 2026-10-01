import type { CartItem } from "./CartView";

export function getCartSubtotal(items: CartItem[]): number | null {
	let subtotal = 0;

	for (const item of items) {
		const price = Number(item.product.price);
		if (item.product.price === undefined || !Number.isFinite(price) || price < 0) {
			return null;
		}
		subtotal += price * item.quantity;
	}

	return subtotal;
}

export function formatCartAmount(amount: number, locale: string): string {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: "HTG",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);
}
