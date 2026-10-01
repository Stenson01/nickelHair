import type { User } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { Menu, Search, ShoppingBasket, UserRound } from "lucide-react";
import { useLanguage } from "../i18n/useLanguage";
import type { ProductFilter } from "./MyProductList";
import "./MyTopAppBar.css";


type MyTopAppBarProps = {
	currentUser: User | null;
	onOpenAccount: () => void;
	onOpenCart: () => void;
	cartItemCount: number;
	onSelectProductFilter: (filter: ProductFilter) => void;
	searchTerm: string;
	onSearchTermChange: (searchTerm: string) => void;
};

export default function MyTopAppBar({
	currentUser,
	onOpenAccount,
	onOpenCart,
	cartItemCount,
	onSelectProductFilter,
	searchTerm,
	onSearchTermChange,
}: MyTopAppBarProps) {
	const { language, setLanguage, t } = useLanguage();
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const menuButtonRef = useRef<HTMLButtonElement>(null);
	const metadata = currentUser?.user_metadata;
	const username =
		(typeof metadata?.username === "string" && metadata.username) ||
		(typeof metadata?.user_name === "string" && metadata.user_name) ||
		currentUser?.email?.split("@")[0] ||
		t("account");
	const profilePicture =
		(typeof metadata?.avatar_url === "string" && metadata.avatar_url) ||
		(typeof metadata?.picture === "string" && metadata.picture) ||
		undefined;

	useEffect(() => {
		if (!isMenuOpen) return;

		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setIsMenuOpen(false);
				menuButtonRef.current?.focus();
			}
		};
		const closeOnOutsideClick = (event: PointerEvent) => {
			if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
				setIsMenuOpen(false);
			}
		};

		document.addEventListener("keydown", closeOnEscape);
		document.addEventListener("pointerdown", closeOnOutsideClick);
		return () => {
			document.removeEventListener("keydown", closeOnEscape);
			document.removeEventListener("pointerdown", closeOnOutsideClick);
		};
	}, [isMenuOpen]);

	const selectProductFilter = (filter: ProductFilter) => {
		onSelectProductFilter(filter);
		setIsMenuOpen(false);
		menuButtonRef.current?.focus();
	};

	const renderSearchForm = (variant: "desktop" | "mobile") => (
		<form
			className={`top-bar__search top-bar__search--${variant}`}
			role="search"
			onSubmit={(event) => event.preventDefault()}
		>
			<input
				type="search"
				placeholder={t("search")}
				aria-label={t("searchProducts")}
				value={searchTerm}
				onChange={(event) => onSearchTermChange(event.target.value)}
			/>
			<button className="top-bar__search-button" type="submit" aria-label={t("submitSearch")}>
				<Search aria-hidden="true" />
			</button>
		</form>
	);

	return (
		<header className="top-bar">
			<div className="top-bar__main-row">
				<div className="top-bar__menu" ref={menuRef}>
					<button
						className="top-bar__icon-button"
						type="button"
						aria-label={t("openMenu")}
						title={t("openMenu")}
						aria-expanded={isMenuOpen}
						aria-controls="top-bar-product-menu"
						ref={menuButtonRef}
						onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
					>
						<Menu aria-hidden="true" />
					</button>
					{isMenuOpen && (
						<nav
							className="top-bar__menu-dropdown"
							id="top-bar-product-menu"
							aria-label={t("menu")}
						>
							<button type="button" onClick={() => selectProductFilter(null)}>
								{t("allProducts")}
							</button>
							<button type="button" onClick={() => selectProductFilter("home-products")}>
								{t("homeProducts")}
							</button>
							<button type="button" onClick={() => selectProductFilter("hair-care")}>
								{t("hairCare")}
							</button>
							<label className="top-bar__language-option">
								<span>{t("language")}</span>
								<select
									className="top-bar__language"
									aria-label={t("language")}
									value={language}
									onChange={(event) => setLanguage(event.target.value as "fr" | "ht")}
								>
									<option value="fr">{t("french")}</option>
									<option value="ht">{t("haitianCreole")}</option>
								</select>
							</label>
						</nav>
					)}
				</div>

				<a className="top-bar__brand" href="/" aria-label="Stenson home">
					Stenson
				</a>

				{renderSearchForm("desktop")}

				<div className="top-bar__actions">
					<button
						className="top-bar__icon-button"
						type="button"
						aria-label={currentUser ? `${t("profile")}: ${username}` : t("account")}
						title={currentUser ? username : t("account")}
						onClick={onOpenAccount}
					>
						{currentUser ? (
							<span className="top-bar__avatar" aria-hidden="true">
								<span className="top-bar__avatar-fallback">
									{username.charAt(0).toUpperCase()}
								</span>
								{profilePicture && (
									<img
										className="top-bar__avatar-image"
										src={profilePicture}
										alt=""
										onError={(event) => {
											event.currentTarget.style.display = "none";
										}}
									/>
								)}
							</span>
						) : (
							<UserRound aria-hidden="true" />
						)}
					</button>
					<button
						className="top-bar__icon-button top-bar__cart-button"
						type="button"
						aria-label={`${t("shoppingBasket")}${cartItemCount > 0 ? ` (${cartItemCount})` : ""}`}
						title={t("shoppingBasket")}
						onClick={onOpenCart}
					>
						<ShoppingBasket aria-hidden="true" />
						{cartItemCount > 0 && (
							<span className="top-bar__cart-count" aria-hidden="true">
								{cartItemCount > 99 ? "99+" : cartItemCount}
							</span>
						)}
					</button>
				</div>
			</div>

			{renderSearchForm("mobile")}
		</header>
	);
}