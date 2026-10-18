import { useState, type FormEvent } from "react";
import { supabaseService } from "../services/supabase/service";
import { useLanguage } from "../i18n/useLanguage";
import "./AuthView.css";

type ForgotPasswordViewProps = {
	onBackToLogin: () => void;
};

export default function ForgotPasswordView({ onBackToLogin }: ForgotPasswordViewProps) {
	const { t } = useLanguage();
	const [email, setEmail] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const [successMessage, setSuccessMessage] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setErrorMessage("");
		setSuccessMessage("");
		setIsSubmitting(true);

		try {
			const { error } = await supabaseService.sendPasswordResetEmail(
				email,
				window.location.origin,
			);
			if (error) {
				setErrorMessage(error.message);
			} else {
				setSuccessMessage(t("passwordResetEmailSent"));
			}
		} catch (error: unknown) {
			setErrorMessage(error instanceof Error ? error.message : t("unableToSendPasswordReset"));
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<main className="auth-view">
			<section className="auth-view__panel" aria-labelledby="forgot-password-title">
				<h1 className="auth-view__title" id="forgot-password-title">
					{t("forgotPassword")}
				</h1>
				<p className="auth-view__description">{t("forgotPasswordDescription")}</p>

				<form className="auth-view__form" onSubmit={(event) => void handleSubmit(event)}>
					<label className="auth-view__field">
						{t("emailAddress")}
						<input
							type="email"
							name="email"
							autoComplete="email"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							required
						/>
					</label>

					{errorMessage && <p className="auth-view__message" role="alert">{errorMessage}</p>}
					{successMessage && (
						<p className="auth-view__message auth-view__message--success" role="status">
							{successMessage}
						</p>
					)}
					<button className="auth-view__submit" type="submit" disabled={isSubmitting}>
						{isSubmitting ? t("sendingPasswordReset") : t("sendPasswordReset")}
					</button>
				</form>

				<p className="auth-view__switch-row">
					<button className="auth-view__switch" type="button" onClick={onBackToLogin}>
						{t("backToSignIn")}
					</button>
				</p>
			</section>
		</main>
	);
}
