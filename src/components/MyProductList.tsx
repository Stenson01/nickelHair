import { useEffect, useState } from "react";
import QuantitySelector from "./QuantitySelector";
import { getProductCode } from "./productUtils";
import { useLanguage } from "../i18n/useLanguage";
import { formatCartAmount } from "../views/cartUtils";
import { isSupabaseConfigured } from "../services/supabase/client";
import { supabaseService } from "../services/supabase/service";
import "./MyProductList.css";

export type Product = {
	id?: string | number;
	code?: string | number;
	product_code?: string | number;
	name?: string;
	title?: string;
	product_name?: string;
	description?: string;
	price?: string | number;
	image_url?: string;
	image?: string;
	category?: unknown;
	category_name?: string;
	Category?: unknown;
	Categories?: unknown;
	categories?: unknown;
};

export type ProductFilter = "home-products" | "hair-care" | null;

type MyProductListProps = {
	selectedFilter: ProductFilter;
	searchTerm: string;
	onSelectedFilterChange: (filter: ProductFilter) => void;
	onSelectProduct: (product: Product) => void;
	onAddToCart: (product: Product, quantity: number) => void;
};

const popularProductFilters = [
	{
		id: "home-products",
		label: "homeProducts",
		keywords: ["home", "household", "housewares", "kitchen", "cleaning", "maison", "menage", "pwodui pou kay", "pwodi nan kay", "kay", "lakay"],
	},
	{
		id: "hair-care",
		label: "hairCare",
		keywords: ["hair", "haircare", "cheveux", "cheve", "soin cheveux", "soin des cheveux", "soins capillaires", "swen cheve", "shampoo", "shampoing", "chanpou", "conditioner", "kondisyone", "leave-in", "hair oil", "lwil", "serum", "sewom", "heat protect", "mousse", "gel", "wax", "pomade"],
	},
] as const;

function normalizeProductText(value: string) {
	return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

function productMatchesFilter(product: Product, keywords: readonly string[]) {
	const categoryNames = [product.category, product.category_name, product.Category, product.Categories, product.categories]
		.flatMap((value) => Array.isArray(value) ? value : [value])
		.flatMap((value) => {
			if (typeof value === "string") return [value];
			if (!value || typeof value !== "object") return [];

			const category = value as Record<string, unknown>;
			return [category.name, category.category_name, category.title, category.label]
				.filter((name): name is string => typeof name === "string");
		});
	const searchableText = [
		product.name,
		product.title,
		product.product_name,
		product.description,
		...categoryNames,
	]
		.filter((value): value is string => typeof value === "string")
		.map(normalizeProductText)
		.join(" ");

	return keywords.some((keyword) => searchableText.includes(normalizeProductText(keyword)));
}

function productMatchesSearch(product: Product, searchTerm: string) {
	const name = product.name ?? product.title ?? product.product_name ?? "";
	return normalizeProductText(name).includes(normalizeProductText(searchTerm.trim()));
}

export default function MyProductList({
	selectedFilter,
	searchTerm,
	onSelectedFilterChange,
	onSelectProduct,
	onAddToCart,
}: MyProductListProps) {
	const { language, t } = useLanguage();
	const priceLocale = language === "fr" ? "fr-HT" : "ht-HT";
	const [products, setProducts] = useState<Product[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState("");
	const [quantities, setQuantities] = useState<Record<string, number>>({});

	useEffect(() => {
		if (!isSupabaseConfigured) {
			setErrorMessage(t("productsUnavailable"));
			setIsLoading(false);
			return;
		}

		let isMounted = true;

		void (async () => {
			try {
				const { data, error } = await supabaseService.getProducts();
				if (!isMounted) return;

				if (error) {
					setErrorMessage(error.message);
					setIsLoading(false);
					return;
				}

				setProducts((data ?? []) as Product[]);
				setIsLoading(false);
			} catch (error: unknown) {
				if (!isMounted) return;

				setErrorMessage(error instanceof Error ? error.message : t("productsLoadError"));
				setIsLoading(false);
			}
		})();

		return () => {
			isMounted = false;
		};
	}, [t]);

	const activeFilter = popularProductFilters.find(({ id }) => id === selectedFilter);
	const categoryProducts = activeFilter
		? products.filter((product) => productMatchesFilter(product, activeFilter.keywords))
		: products;
	const visibleProducts = searchTerm.trim()
		? categoryProducts.filter((product) => productMatchesSearch(product, searchTerm))
		: categoryProducts;

	return (
		<section className="product-list" aria-label={t("productsTitle")}>
			{products.length > 0 && (
				<div className="product-type-slider" role="group" aria-label={t("productCategories")}>
					<button
						className={`product-type-slider__button${selectedFilter === null ? " is-active" : ""}`}
						type="button"
						aria-pressed={selectedFilter === null}
						onClick={() => onSelectedFilterChange(null)}
					>
						{t("allProducts")}
					</button>
					{popularProductFilters.map((filter) => (
						<button
							className={`product-type-slider__button${selectedFilter === filter.id ? " is-active" : ""}`}
							key={filter.id}
							type="button"
							aria-pressed={selectedFilter === filter.id}
							onClick={() => onSelectedFilterChange(filter.id)}
						>
							{t(filter.label)}
						</button>
					))}
				</div>
			)}
			{isLoading && <p role="status">{t("productsLoading")}</p>}
			{!isLoading && errorMessage && <p role="alert">{errorMessage}</p>}
			{!isLoading && !errorMessage && products.length === 0 && (
				<p>{t("productsEmpty")}</p>
			)}
			{!isLoading && !errorMessage && products.length > 0 && visibleProducts.length === 0 && (
				<p>{searchTerm.trim() ? t("noProductsForSearch") : t("noProductsForType")}</p>
			)}

			{!isLoading && !errorMessage && products.length > 0 && (
				<div className="product-list__grid">
					{visibleProducts.map((product, index) => {
						const name = product.name ?? product.title ?? product.product_name ?? t("unnamedProduct");
						const imageUrl = product.image_url ?? product.image;
						const productKey = getProductCode(product) ?? `${name}-${index}`;
						const quantity = quantities[productKey] ?? 1;
						const price = Number(product.price);

						return (
							<article
								className="product-list__item"
								key={productKey}
							>
								<button
									className="product-list__open-details"
									type="button"
									onClick={() => onSelectProduct(product)}
									aria-label={`${name} — ${t("viewProductDetails")}`}
								>
									<div className="product-list__media">
										{imageUrl && <img src={imageUrl} alt="" loading="lazy" />}
									</div>
									<div className="product-list__details">
										<h3>{name}</h3>
										{product.description && <p>{product.description}</p>}
										{product.price !== undefined && Number.isFinite(price) && (
											<span>{formatCartAmount(price, priceLocale)}</span>
										)}
									</div>
								</button>
								<QuantitySelector
									quantity={quantity}
									onChange={(nextQuantity) => setQuantities((current) => ({
										...current,
										[productKey]: nextQuantity,
									}))}
									label={`${t("quantity")}: ${name}`}
									decreaseLabel={`${t("decreaseQuantity")}: ${name}`}
									increaseLabel={`${t("increaseQuantity")}: ${name}`}
								/>
								<button
									className="add-to-cart-button product-list__add-to-cart"
									type="button"
									onClick={() => onAddToCart(product, quantity)}
								>
									{t("addToCart")}
								</button>
							</article>
						);
					})}
				</div>
			)}
		</section>
	);
}