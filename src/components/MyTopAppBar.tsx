import type { User } from "@supabase/supabase-js";
import { Menu, Search, ShoppingBasket, UserRound } from "lucide-react";
import { useLanguage } from "../i18n/useLanguage";
import "./MyTopAppBar.css";


type MyTopAppBarProps = {
	currentUser: User | null;
};

export default function MyTopAppBar({ currentUser }: MyTopAppBarProps) {
	const { language, setLanguage, t } = useLanguage();
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

	return (
		<header className="top-bar">
			<div className="top-bar__main-row">
				<button className="top-bar__icon-button" type="button" aria-label={t("openMenu")} title={t("openMenu")}>
					<Menu aria-hidden="true" />
				</button>

				<a className="top-bar__brand" href="/" aria-label="Stenson home">
					Stenson
				</a>
				<select
					className="top-bar__language"
					aria-label={t("language")}
					value={language}
					onChange={(event) => setLanguage(event.target.value as "fr" | "ht")}
				>
					<option value="fr">{t("french")}</option>
					<option value="ht">{t("haitianCreole")}</option>
				</select>

				<form className="top-bar__search top-bar__search--desktop" role="search">
					<input type="search" placeholder={t("search")} aria-label={t("searchProducts")} />
					<button className="top-bar__search-button" type="submit" aria-label={t("submitSearch")}>
						<Search aria-hidden="true" />
					</button>
				</form>

				<div className="top-bar__actions">
					<button
						className="top-bar__icon-button"
						type="button"
						aria-label={currentUser ? `${t("profile")}: ${username}` : t("account")}
						title={currentUser ? username : t("account")}
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
					<button className="top-bar__icon-button" type="button" aria-label={t("shoppingBasket")} title={t("shoppingBasket")}>
						<ShoppingBasket aria-hidden="true" />
					</button>
				</div>
			</div>

			<form className="top-bar__search top-bar__search--mobile" role="search">
				<input type="search" placeholder={t("search")} aria-label={t("searchProducts")} />
				<button className="top-bar__search-button" type="submit" aria-label={t("submitSearch")}>
					<Search aria-hidden="true" />
				</button>
			</form>
		</header>
	);
}