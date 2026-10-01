import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useLanguage } from "../i18n/useLanguage";
import { supabaseService } from "../services/supabase/service";
import "./ProfileView.css";

type ProfileViewProps = {
	user: User;
	onSignOut: () => void;
};

export default function ProfileView({ user, onSignOut }: ProfileViewProps) {
	const { t } = useLanguage();
	const [errorMessage, setErrorMessage] = useState("");
	const [isSigningOut, setIsSigningOut] = useState(false);
	const [isSignOutConfirmationOpen, setIsSignOutConfirmationOpen] = useState(false);
	const metadata = user.user_metadata;
	const username =
		(typeof metadata?.username === "string" && metadata.username) ||
		(typeof metadata?.user_name === "string" && metadata.user_name) ||
		user.email?.split("@")[0] ||
		t("profile");

	async function handleSignOut() {
		setErrorMessage("");
		setIsSigningOut(true);

		try {
			const { error } = await supabaseService.signOut();
			if (error) {
				setErrorMessage(error.message);
				return;
			}
			onSignOut();
		} catch (error: unknown) {
			setErrorMessage(error instanceof Error ? error.message : t("unableToSignOut"));
		} finally {
			setIsSigningOut(false);
		}
	}

	return (
		<main className="profile-view">
			<section className="profile-view__panel" aria-labelledby="profile-title">
				<p className="profile-view__eyebrow">{t("stensonAccount")}</p>
				<h1 className="profile-view__title" id="profile-title">{t("profileTitle")}</h1>
				<p className="profile-view__name">{username}</p>
				{user.email && (
					<p className="profile-view__email">
						<span>{t("emailAddress")}</span>
						{user.email}
					</p>
				)}
				{errorMessage && <p className="profile-view__error" role="alert">{errorMessage}</p>}
				{isSignOutConfirmationOpen ? (
					<div className="profile-view__confirmation" role="group" aria-label={t("confirmSignOut")}>
						<p>{t("confirmSignOut")}</p>
						<div className="profile-view__confirmation-actions">
							<button
								className="profile-view__cancel-sign-out"
								type="button"
								onClick={() => {
									setErrorMessage("");
									setIsSignOutConfirmationOpen(false);
								}}
								disabled={isSigningOut}
							>
								{t("cancel")}
							</button>
							<button
								className="profile-view__sign-out"
								type="button"
								onClick={() => void handleSignOut()}
								disabled={isSigningOut}
							>
								{isSigningOut ? t("signingOut") : t("confirm")}
							</button>
						</div>
					</div>
				) : (
					<button
						className="profile-view__sign-out"
						type="button"
						onClick={() => setIsSignOutConfirmationOpen(true)}
					>
						{t("signOut")}
					</button>
				)}
			</section>
		</main>
	);
}