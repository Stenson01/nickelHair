import { ArrowLeft, ShoppingBasket } from "lucide-react";
import { useState } from "react";
import QuantitySelector from "../components/QuantitySelector";
import { useLanguage } from "../i18n/useLanguage";
import type { Product } from "../components/MyProductList";
import { formatCartAmount } from "./cartUtils";
import "./ProductsDetailsView.css";

type ProductsDetailsViewProps = {
	product: Product;
	onBack: () => void;
	onAddToCart: (product: Product, quantity: number) => void;
};

export default function ProductsDetailsView({ product, onBack, onAddToCart }: ProductsDetailsViewProps) {
	const { language, t } = useLanguage();
	const [quantity, setQuantity] = useState(1);
	const name = product.name ?? product.title ?? product.product_name ?? t("unnamedProduct");
	const imageUrl = product.image_url ?? product.image;
	const price = Number(product.price);
	const priceLocale = language === "fr" ? "fr-HT" : "ht-HT";

	return (
		<main className="product-details">
			<button className="product-details__back" type="button" onClick={onBack}>
				<ArrowLeft aria-hidden="true" />
				{t("backToProducts")}
			</button>
			<article className="product-details__card">
				<div className="product-details__media">
					{imageUrl && <img src={imageUrl} alt={name} />}
				</div>
				<div className="product-details__content">
					<h1>{name}</h1>
					{product.price !== undefined && Number.isFinite(price) && (
						<p className="product-details__price">{formatCartAmount(price, priceLocale)}</p>
					)}
					{product.description && (
						<p className="product-details__description">{product.description}</p>
					)}
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
				</div>
			</article>
		</main>
	);
}
