import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabaseService } from "../services/supabase/service";
import { useLanguage } from "../i18n/useLanguage";
import "./AuthView.css";

type PasswordResetViewProps = {
	onPasswordUpdated: () => void;
};

export default function PasswordResetView({ onPasswordUpdated }: PasswordResetViewProps) {
	const { t } = useLanguage();
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isPasswordVisible, setIsPasswordVisible] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setErrorMessage("");

		if (password !== confirmPassword) {
			setErrorMessage(t("passwordsDoNotMatch"));
			return;
		}

		setIsSubmitting(true);
		try {
			const { error } = await supabaseService.updatePassword(password);
			if (error) throw error;
			onPasswordUpdated();
		} catch (error: unknown) {
			setErrorMessage(error instanceof Error ? error.message : t("unableToUpdatePassword"));
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<main className="auth-view">
			<section className="auth-view__panel" aria-labelledby="reset-password-title">
				<h1 className="auth-view__title" id="reset-password-title">
					{t("resetPasswordTitle")}
				</h1>
				<p className="auth-view__description">{t("resetPasswordDescription")}</p>

				<form className="auth-view__form" onSubmit={(event) => void handleSubmit(event)}>
					<label className="auth-view__field">
						{t("newPassword")}
						<span className="auth-view__password-control">
							<input
								type={isPasswordVisible ? "text" : "password"}
								name="new-password"
								autoComplete="new-password"
								minLength={6}
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								required
							/>
							<button
								className="auth-view__password-toggle"
								type="button"
								aria-label={isPasswordVisible ? t("hidePassword") : t("showPassword")}
								aria-pressed={isPasswordVisible}
								onClick={() => setIsPasswordVisible((visible) => !visible)}
							>
								{isPasswordVisible
									? <EyeOff aria-hidden="true" />
									: <Eye aria-hidden="true" />}
							</button>
						</span>
					</label>

					<label className="auth-view__field">
						{t("confirmPassword")}
						<input
							type={isPasswordVisible ? "text" : "password"}
							name="confirm-password"
							autoComplete="new-password"
							minLength={6}
							value={confirmPassword}
							onChange={(event) => setConfirmPassword(event.target.value)}
							required
						/>
					</label>

					{errorMessage && <p className="auth-view__message" role="alert">{errorMessage}</p>}
					<button className="auth-view__submit" type="submit" disabled={isSubmitting}>
						{isSubmitting ? t("updatingPassword") : t("updatePassword")}
					</button>
				</form>
			</section>
		</main>
	);
}
