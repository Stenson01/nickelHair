import { useState, type FormEvent } from "react";
import { supabaseService } from "../services/supabase/service";
import { useLanguage } from "../i18n/useLanguage";
import "./AuthView.css";

type SignupViewProps = {
	onSwitchToLogin: () => void;
};

export default function SignupView({ onSwitchToLogin }: SignupViewProps) {
	const { t } = useLanguage();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const [successMessage, setSuccessMessage] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setErrorMessage("");
		setSuccessMessage("");
		setIsSubmitting(true);

		try {
			const { data, error } = await supabaseService.signUp(email, password);
			if (error) {
				setErrorMessage(error.message);
			} else if (!data.session) {
				setSuccessMessage(t("checkEmailConfirmation"));
			} else {
				setSuccessMessage(t("accountCreated"));
			}
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : t("unableToCreateAccount"));
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<main className="auth-view">
			<section className="auth-view__panel" aria-labelledby="signup-title">
				<p className="auth-view__eyebrow">{t("stensonAccount")}</p>
				<h1 className="auth-view__title" id="signup-title">{t("createAccount")}</h1>
				<p className="auth-view__description">{t("createAccountDescription")}</p>

				<form className="auth-view__form" onSubmit={handleSubmit}>
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

					<label className="auth-view__field">
						{t("password")}
						<input
							type="password"
							name="new-password"
							autoComplete="new-password"
							minLength={6}
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							required
						/>
					</label>

					{errorMessage && <p className="auth-view__message" role="alert">{errorMessage}</p>}
					{successMessage && <p className="auth-view__message auth-view__message--success" role="status">{successMessage}</p>}
					<button className="auth-view__submit" type="submit" disabled={isSubmitting}>
						{isSubmitting ? t("creatingAccount") : t("createAccount")}
					</button>
				</form>

				<p className="auth-view__switch-row">
					{t("alreadyHaveAccount")} {" "}
					<button className="auth-view__switch" type="button" onClick={onSwitchToLogin}>
						{t("signIn")}
					</button>
				</p>
			</section>
		</main>
	);
}