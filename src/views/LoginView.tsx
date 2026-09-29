import { useState, type FormEvent } from "react";
import { supabaseService } from "../services/supabase/service";
import { useLanguage } from "../i18n/useLanguage";
import "./AuthView.css";

type LoginViewProps = {
	onSwitchToSignup: () => void;
};

export default function LoginView({ onSwitchToSignup }: LoginViewProps) {
	const { t } = useLanguage();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setErrorMessage("");
		setIsSubmitting(true);

		try {
			const { error } = await supabaseService.signIn(email, password);
			if (error) setErrorMessage(error.message);
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : t("unableToSignIn"));
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<main className="auth-view">
			<section className="auth-view__panel" aria-labelledby="login-title">
				<p className="auth-view__eyebrow">{t("stensonAccount")}</p>
				<h1 className="auth-view__title" id="login-title">{t("welcomeBack")}</h1>
				<p className="auth-view__description">{t("signInDescription")}</p>

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
							name="password"
							autoComplete="current-password"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							required
						/>
					</label>

					{errorMessage && <p className="auth-view__message" role="alert">{errorMessage}</p>}
					<button className="auth-view__submit" type="submit" disabled={isSubmitting}>
						{isSubmitting ? t("signingIn") : t("signIn")}
					</button>
				</form>

				<p className="auth-view__switch-row">
					{t("newToStenson")} {" "}
					<button className="auth-view__switch" type="button" onClick={onSwitchToSignup}>
						{t("createAccount")}
					</button>
				</p>
			</section>
		</main>
	);
}