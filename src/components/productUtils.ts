import type { Product } from "./MyProductList";

export function getProductCode(product: Product): string | null {
	const code = product.code ?? product.product_code ?? product.id;
	if (typeof code !== "string" && typeof code !== "number") return null;

	const normalizedCode = String(code).trim();
	return normalizedCode.length > 0 ? normalizedCode : null;
}
