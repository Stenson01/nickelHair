import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/useLanguage";
import { isSupabaseConfigured } from "../services/supabase/client";
import { supabaseService } from "../services/supabase/service";
import "./MyProductList.css";

type Product = {
	id?: string | number;
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

export default function MyProductList() {
	const { t } = useLanguage();
	const [products, setProducts] = useState<Product[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState("");
	const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

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
	const visibleProducts = activeFilter
		? products.filter((product) => productMatchesFilter(product, activeFilter.keywords))
		: products;

	return (
		<section className="product-list" aria-label={t("productsTitle")}>
			{products.length > 0 && (
				<div className="product-type-slider" role="group" aria-label={t("productCategories")}>
					<button
						className={`product-type-slider__button${selectedFilter === null ? " is-active" : ""}`}
						type="button"
						aria-pressed={selectedFilter === null}
						onClick={() => setSelectedFilter(null)}
					>
						{t("allProducts")}
					</button>
					{popularProductFilters.map((filter) => (
						<button
							className={`product-type-slider__button${selectedFilter === filter.id ? " is-active" : ""}`}
							key={filter.id}
							type="button"
							aria-pressed={selectedFilter === filter.id}
							onClick={() => setSelectedFilter(filter.id)}
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
			{!isLoading && !errorMessage && activeFilter && visibleProducts.length === 0 && (
				<p>{t("noProductsForType")}</p>
			)}

			{!isLoading && !errorMessage && products.length > 0 && (
				<div className="product-list__grid">
					{visibleProducts.map((product, index) => {
						const name = product.name ?? product.title ?? product.product_name ?? t("unnamedProduct");
						const imageUrl = product.image_url ?? product.image;

						return (
							<article
								className="product-list__item"
								key={product.id ?? `${name}-${index}`}
							>
								<div className="product-list__media">
									{imageUrl && <img src={imageUrl} alt={name} loading="lazy" />}
								</div>
								<div className="product-list__details">
									<h3>{name}</h3>
									{product.description && <p>{product.description}</p>}
									{product.price !== undefined && <span>{product.price}</span>}
								</div>
							</article>
						);
					})}
				</div>
			)}
		</section>
	);
}