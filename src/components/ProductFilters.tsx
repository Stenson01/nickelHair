import { useLanguage } from "../i18n/useLanguage";
import type { ProductFilter, ProductSort } from "./productFilterTypes";
import "./ProductFilters.css";

type ProductFiltersProps = {
	idPrefix: string;
	selectedFilter: ProductFilter;
	onSelectFilter: (filter: ProductFilter) => void;
	sort: ProductSort;
	onSelectSort: (sort: ProductSort) => void;
};

const productCategories: { id: Exclude<ProductFilter, null>; label: "homeProducts" | "hairCare" }[] = [
	{ id: "home-products", label: "homeProducts" },
	{ id: "hair-care", label: "hairCare" },
];

const productSortOptions: { id: ProductSort; label: "featuredOrder" | "priceLowToHigh" | "priceHighToLow" | "nameAscending" }[] = [
	{ id: "featured", label: "featuredOrder" },
	{ id: "price-ascending", label: "priceLowToHigh" },
	{ id: "price-descending", label: "priceHighToLow" },
	{ id: "name-ascending", label: "nameAscending" },
];

export default function ProductFilters({
	idPrefix,
	selectedFilter,
	onSelectFilter,
	sort,
	onSelectSort,
}: ProductFiltersProps) {
	const { language, setLanguage, t } = useLanguage();

	return (
		<>
			<fieldset className="product-filters__group">
				<legend>{t("productCategories")}</legend>
				<label>
					<input
						type="radio"
						name={`${idPrefix}-category`}
						checked={selectedFilter === null}
						onChange={() => onSelectFilter(null)}
					/>
					{t("allProducts")}
				</label>
				{productCategories.map(({ id, label }) => (
					<label key={id}>
						<input
							type="radio"
							name={`${idPrefix}-category`}
							checked={selectedFilter === id}
							onChange={() => onSelectFilter(id)}
						/>
						{t(label)}
					</label>
				))}
			</fieldset>
			<fieldset className="product-filters__group">
				<legend>{t("sortProducts")}</legend>
				{productSortOptions.map(({ id, label }) => (
					<label key={id}>
						<input
							type="radio"
							name={`${idPrefix}-sort`}
							checked={sort === id}
							onChange={() => onSelectSort(id)}
						/>
						{t(label)}
					</label>
				))}
			</fieldset>
			<label className="product-filters__language">
				<span>{t("language")}</span>
				<select
					aria-label={t("language")}
					value={language}
					onChange={(event) => setLanguage(event.target.value as "fr" | "ht")}
				>
					<option value="fr">{t("french")}</option>
					<option value="ht">{t("haitianCreole")}</option>
				</select>
			</label>
		</>
	);
}
