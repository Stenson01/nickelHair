import { useState, type ReactNode } from "react";
import { LanguageContext } from "./language-context";
import { type Language, translations } from "./translations";

const languageStorageKey = "stenson-language";

function getInitialLanguage(): Language {
	if (typeof window === "undefined") return "ht";

	const savedLanguage = window.localStorage.getItem(languageStorageKey);
	// Default to Haitian Creole (ht) when there is no saved preference
	return savedLanguage === "fr" ? "fr" : "ht";
}

type LanguageProviderProps = {
	children: ReactNode;
};

export function LanguageProvider({ children }: LanguageProviderProps) {
	const [language, setLanguageState] = useState<Language>(getInitialLanguage);

	function setLanguage(nextLanguage: Language) {
		window.localStorage.setItem(languageStorageKey, nextLanguage);
		setLanguageState(nextLanguage);
	}

	function t(key: keyof typeof translations.fr) {
		return translations[language][key];
	}

	return (
		<LanguageContext.Provider value={{ language, setLanguage, t }}>
			{children}
		</LanguageContext.Provider>
	);
}