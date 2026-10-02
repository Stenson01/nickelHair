import { useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { getProductCode } from "./productUtils";
import ProductFilters from "./ProductFilters";
import type { ProductFilter, ProductSort } from "./productFilterTypes";
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

export type { ProductFilter } from "./productFilterTypes";

type MyProductListProps = {
	selectedFilter: ProductFilter;
	onSelectFilter: (filter: ProductFilter) => void;
	sort: ProductSort;
	onSelectSort: (sort: ProductSort) => void;
	searchTerm: string;
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

function ProductImage({ src }: { src: string }) {
	const [isLoaded, setIsLoaded] = useState(false);
	const [hasError, setHasError] = useState(false);

	return (
		<div className={`product-list__image-frame${isLoaded ? " is-loaded" : ""}${hasError ? " has-error" : ""}`}>
			<img
				src={src}
				alt=""
				loading="lazy"
				decoding="async"
				fetchPriority="low"
				onLoad={() => setIsLoaded(true)}
				onError={() => setHasError(true)}
			/>
		</div>
	);
}

function ProductCardSkeleton() {
	return (
		<article className="product-list__item product-list__item--skeleton" aria-hidden="true">
			<div className="product-list__media" />
			<div className="product-list__details" />
		</article>
	);
}

export default function MyProductList({
	selectedFilter,
	onSelectFilter,
	sort,
	onSelectSort,
	searchTerm,
	onSelectProduct,
	onAddToCart,
}: MyProductListProps) {
	const { language, t } = useLanguage();
	const priceLocale = language === "fr" ? "fr-HT" : "ht-HT";
	const [products, setProducts] = useState<Product[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState("");

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
	const sortedProducts = [...visibleProducts].sort((first, second) => {
		if (sort === "name-ascending") {
			const firstName = first.name ?? first.title ?? first.product_name ?? "";
			const secondName = second.name ?? second.title ?? second.product_name ?? "";
			return firstName.localeCompare(secondName, language);
		}

		if (sort === "price-ascending" || sort === "price-descending") {
			const firstPrice = Number(first.price);
			const secondPrice = Number(second.price);
			const firstHasPrice = first.price !== undefined && Number.isFinite(firstPrice);
			const secondHasPrice = second.price !== undefined && Number.isFinite(secondPrice);

			if (!firstHasPrice || !secondHasPrice) {
				return firstHasPrice === secondHasPrice ? 0 : firstHasPrice ? -1 : 1;
			}

			return sort === "price-ascending" ? firstPrice - secondPrice : secondPrice - firstPrice;
		}

		return 0;
	});

	return (
		<section className="product-list" aria-label={t("productsTitle")}>
			<div className="product-list__layout">
				<aside className="product-list__filters" aria-label={t("productFilters")}>
					<ProductFilters
						idPrefix="sidebar"
						selectedFilter={selectedFilter}
						onSelectFilter={onSelectFilter}
						sort={sort}
						onSelectSort={onSelectSort}
					/>
				</aside>
				<div className="product-list__content">
					{isLoading && (
						<>
							<p className="visually-hidden" role="status">{t("productsLoading")}</p>
							<div className="product-list__grid" aria-hidden="true">
								{Array.from({ length: 6 }, (_, index) => (
									<ProductCardSkeleton key={index} />
								))}
							</div>
						</>
					)}
					{!isLoading && errorMessage && <p role="alert">{errorMessage}</p>}
					{!isLoading && !errorMessage && products.length === 0 && (
						<p>{t("productsEmpty")}</p>
					)}
					{!isLoading && !errorMessage && products.length > 0 && sortedProducts.length === 0 && (
						<p>{searchTerm.trim() ? t("noProductsForSearch") : t("noProductsForType")}</p>
					)}

					{!isLoading && !errorMessage && products.length > 0 && (
						<div className="product-list__grid">
							{sortedProducts.map((product, index) => {
						const name = product.name ?? product.title ?? product.product_name ?? t("unnamedProduct");
						const imageUrl = product.image_url ?? product.image;
						const productKey = getProductCode(product) ?? `${name}-${index}`;
						const price = Number(product.price);

						return (
							<article
								className="product-list__item"
								key={productKey}
							>
								<div className="product-list__visual">
									<button
										className="product-list__open-image"
										type="button"
										onClick={() => onSelectProduct(product)}
										aria-label={`${name} — ${t("viewProductDetails")}`}
									>
									<div className="product-list__media">
										{imageUrl && <ProductImage key={imageUrl} src={imageUrl} />}
									</div>
									</button>
									<button
										className="product-list__add-to-cart"
										type="button"
										aria-label={`${t("addToCart")}: ${name}`}
										title={t("addToCart")}
										onClick={() => onAddToCart(product, 1)}
									>
										<ShoppingCart aria-hidden="true" />
									</button>
								</div>
								<button
									className="product-list__details product-list__details-button"
									type="button"
									onClick={() => onSelectProduct(product)}
									aria-label={`${name} — ${t("viewProductDetails")}`}
								>
									<h3>{name}</h3>
									{product.description && <p>{product.description}</p>}
									{product.price !== undefined && Number.isFinite(price) && (
										<span>{formatCartAmount(price, priceLocale)}</span>
									)}
								</button>
							</article>
						);
							})}
						</div>
					)}
				</div>
			</div>
		</section>
	);
}