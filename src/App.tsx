import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useLanguage } from "./i18n/useLanguage";
import MyTopAppBar from "./components/MyTopAppBar";
import MyProductList, { type Product } from "./components/MyProductList";
import type { ProductFilter, ProductSort } from "./components/productFilterTypes";
import { getProductCode } from "./components/productUtils";
import CartView, { type CartItem } from "./views/CartView";
import CheckoutView from "./views/CheckoutView";
import { isSupabaseConfigured } from "./services/supabase/client";
import { supabaseService } from "./services/supabase/service";
import LoginView from "./views/LoginView";
import ForgotPasswordView from "./views/ForgotPasswordView";
import PasswordResetView from "./views/PasswordResetView";
import ProfileView from "./views/ProfileView";
import ProductsDetailsView from "./views/ProductsDetailsView";
import OrderHistoryView from "./views/OrderHistoryView";
import AdminView from "./views/AdminView";
import SignupView from "./views/SignupView";
import "./App.css";

type AppView = "store" | "login" | "signup" | "forgot-password" | "reset-password" | "profile" | "admin" | "product-details" | "cart" | "checkout" | "orders";

type AppNavigationState = {
	appNavigation: true;
	hasPreviousAppView: boolean;
	view: AppView;
	selectedProduct: Product | null;
};

type PendingCartAddition = {
	product: Product;
	quantity: number;
	searchTerm?: string;
};

function isAppView(value: unknown): value is AppView {
	return value === "store" ||
		value === "login" ||
		value === "signup" ||
		value === "forgot-password" ||
		value === "reset-password" ||
		value === "profile" ||
		value === "admin" ||
		value === "product-details" ||
		value === "cart" ||
		value === "checkout" ||
		value === "orders";
}

export default function App() {
  const { t } = useLanguage();
  const hasRecordedPageView = useRef(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isStoreAdmin, setIsStoreAdmin] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<ProductFilter>(null);
  const [productSort, setProductSort] = useState<ProductSort>("featured");
  const [currentView, setCurrentView] = useState<AppView>("store");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartLoading, setIsCartLoading] = useState(false);
  const [cartRefreshVersion, setCartRefreshVersion] = useState(0);
  const [pendingCartAddition, setPendingCartAddition] = useState<PendingCartAddition | null>(null);
  const [pendingViewAfterAuth, setPendingViewAfterAuth] = useState<AppView | null>(null);
  const [cartError, setCartError] = useState("");
  const [cartConfirmation, setCartConfirmation] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const navigateToView = (
    view: AppView,
    product: Product | null = null,
    replaceCurrent = false,
  ) => {
    const state: AppNavigationState = {
      appNavigation: true,
      hasPreviousAppView: replaceCurrent
        ? window.history.state?.hasPreviousAppView === true
        : window.history.state?.appNavigation === true,
      view,
      selectedProduct: product,
    };
    if (replaceCurrent) {
      window.history.replaceState(state, "");
    } else {
      window.history.pushState(state, "");
    }
    setSelectedProduct(product);
    setCurrentView(view);
  };

  const goBack = (fallbackView: AppView = "store") => {
    const state = window.history.state as Partial<AppNavigationState> | null;
    if (state?.appNavigation && state.hasPreviousAppView) {
      window.history.back();
      return;
    }

    navigateToView(fallbackView);
  };

  useEffect(() => {
    if (!cartConfirmation) return;
    const timeoutId = window.setTimeout(() => setCartConfirmation(""), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [cartConfirmation]);

  useEffect(() => {
    const initialState: AppNavigationState = {
      appNavigation: true,
      hasPreviousAppView: false,
      view: "store",
      selectedProduct: null,
    };
    window.history.replaceState(initialState, "");

    const restoreView = (event: PopStateEvent) => {
      const state = event.state as Partial<AppNavigationState> | null;
      if (!state?.appNavigation || !isAppView(state.view)) {
        setSelectedProduct(null);
        setCurrentView("store");
        return;
      }

      setSelectedProduct(state.selectedProduct ?? null);
      setCurrentView(state.view);
    };

    window.addEventListener("popstate", restoreView);
    return () => window.removeEventListener("popstate", restoreView);
  }, []);

  useEffect(() => {
    if (hasRecordedPageView.current) return;
    hasRecordedPageView.current = true;

    const pageViewCountedDayKey = "stenson-page-view-counted-day";
    const visitDay = new Date().toISOString().slice(0, 10);
    let claimedDailyVisit = false;

    try {
      window.localStorage.removeItem("stenson-analytics-consent");
      window.localStorage.removeItem("stenson-visitor-id");
      window.sessionStorage.removeItem("stenson-visitor-session-id");

      for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
        const key = window.sessionStorage.key(index);
        if (key?.startsWith("stenson-analytics-")) {
          window.sessionStorage.removeItem(key);
        }
      }

      if (window.localStorage.getItem(pageViewCountedDayKey) === visitDay) return;

      window.localStorage.setItem(pageViewCountedDayKey, visitDay);
      claimedDailyVisit = true;
    } catch (error: unknown) {
      console.error("Unable to read or save the daily page-view marker:", error);
    }

    if (!isSupabaseConfigured) return;

    void (async () => {
      try {
        const { error } = await supabaseService.recordAnonymousPageView();
        if (error) throw error;
      } catch (error: unknown) {
        if (claimedDailyVisit) {
          try {
            if (window.localStorage.getItem(pageViewCountedDayKey) === visitDay) {
              window.localStorage.removeItem(pageViewCountedDayKey);
            }
          } catch (storageError: unknown) {
            console.error("Unable to clear the failed daily page-view marker:", storageError);
          }
        }
        console.error("Unable to record anonymous page view:", error);
      }
    })();
  }, []);

  const handleSearchTermChange = (value: string) => {
    setSearchTerm(value);
    setSelectedFilter(null);
    if (currentView !== "store") navigateToView("store");
  };

  const persistCartAddition = async ({ product, quantity }: PendingCartAddition) => {
    const productCode = getProductCode(product);
    if (!productCode) {
      setCartError(t("productUnavailableForCart"));
      return false;
    }

    try {
      await supabaseService.addCartItem(productCode, quantity);
      setCartItems((items) => {
        const existingItem = items.find((item) => item.key === productCode);
        if (existingItem) {
          return items.map((item) =>
            item.key === productCode ? { ...item, quantity: item.quantity + quantity } : item,
          );
        }
        return [...items, { key: productCode, product, quantity }];
      });
      setCartError("");
      const productName = product.name ?? product.title ?? product.product_name ?? t("unnamedProduct");
      setCartConfirmation(`${t("productAddedToCart")}: ${productName}`);
      return true;
    } catch (error: unknown) {
      setCartError(error instanceof Error ? error.message : t("unableToLoadCart"));
      return false;
    }
  };

  const addToCart = async (product: Product, quantity: number, searchTerm?: string) => {
    const addition = { product, quantity, searchTerm };
    setCartError("");
    if (!currentUser) {
      setPendingCartAddition(addition);
      navigateToView("login");
      return;
    }

    await persistCartAddition(addition);
  };

  const handleSignedIn = async () => {
    if (pendingCartAddition) {
      const wasAdded = await persistCartAddition(pendingCartAddition);
      setPendingCartAddition(null);
      navigateToView(wasAdded ? "cart" : "profile", null, true);
      return;
    }
    if (pendingViewAfterAuth) {
      const nextView = pendingViewAfterAuth;
      setPendingViewAfterAuth(null);
      navigateToView(nextView, null, true);
      return;
    }
    navigateToView("profile", null, true);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;
    const { data: authListener } = supabaseService.client.auth.onAuthStateChange((event, session) => {
      setCurrentUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") {
        window.setTimeout(() => navigateToView("reset-password", null, true), 0);
      }
    });

    void supabaseService.getCurrentUser().then(({ data, error }) => {
      if (!isMounted) return;

      if (error) {
        console.error("Unable to fetch the current Supabase user:", error.message);
        return;
      }

      setCurrentUser(data.user);
    }).catch((error: unknown) => {
      if (isMounted) {
        console.error("Unable to fetch the current Supabase user:", error);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setIsStoreAdmin(false);
      return;
    }

    let isMounted = true;
    void supabaseService.isStoreAdmin().then((allowed) => {
      if (isMounted) setIsStoreAdmin(allowed);
    }).catch((error: unknown) => {
      if (isMounted) {
        setIsStoreAdmin(false);
        console.error("Unable to verify store administrator access:", error);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setCartItems([]);
      setIsCartLoading(false);
      return;
    }

    let isMounted = true;
    setCartError("");
    setIsCartLoading(true);
    void (async () => {
      try {
        const [entries, productsResult] = await Promise.all([
          supabaseService.getCartItems(),
          supabaseService.getProducts(),
        ]);
        if (!isMounted) return;
        if (productsResult.error) throw productsResult.error;

        const productsById = new Map(
          ((productsResult.data ?? []) as Product[])
            .map((product) => [getProductCode(product), product] as const)
            .filter((entry): entry is readonly [string, Product] => entry[0] !== null),
        );
        setCartItems(entries.map(({ product_id, quantity }) => ({
          key: product_id,
          product: productsById.get(product_id) ?? { code: product_id },
          quantity,
        })));
      } catch (error: unknown) {
        if (isMounted) {
          setCartError(error instanceof Error ? error.message : t("unableToLoadCart"));
        }
      } finally {
        if (isMounted) setIsCartLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [currentUser, cartRefreshVersion, t]);

  const updateCartQuantity = async (key: string, quantity: number) => {
    try {
      await supabaseService.setCartItemQuantity(key, quantity);
      setCartItems((items) =>
        quantity === 0
          ? items.filter((item) => item.key !== key)
          : items.map((item) => item.key === key ? { ...item, quantity } : item),
      );
      setCartError("");
    } catch (error: unknown) {
      setCartError(error instanceof Error ? error.message : t("unableToLoadCart"));
    }
  };

  return (
    <>
      {currentView === "store" && <MyTopAppBar
        currentUser={currentUser}
        onOpenAccount={() => {
          navigateToView(currentUser ? "profile" : "login");
        }}
        onOpenCart={() => {
          navigateToView("cart");
          if (currentUser) setCartRefreshVersion((version) => version + 1);
        }}
        onOpenOrders={() => {
          if (currentUser) {
            navigateToView("orders");
          } else {
            setPendingViewAfterAuth("orders");
            navigateToView("login");
          }
        }}
        cartItemCount={cartItems.reduce((count, item) => count + item.quantity, 0)}
        selectedFilter={selectedFilter}
        onSelectProductFilter={setSelectedFilter}
        productSort={productSort}
        onSelectProductSort={setProductSort}
        searchTerm={searchTerm}
        onSearchTermChange={handleSearchTermChange}
      />}
      {currentView !== "store" && (
        <div className="app-home-navigation">
          <button
            className="app-home-navigation__button"
            type="button"
            onClick={() => goBack()}
          >
            <ArrowLeft aria-hidden="true" />
            {t("backToPrevious")}
          </button>
        </div>
      )}
      {cartError && <p className="app-cart-error" role="alert">{cartError}</p>}
      {cartConfirmation && (
        <p className="app-cart-confirmation" role="status" aria-live="polite">
          {cartConfirmation}
        </p>
      )}
      {currentView === "store" && (
        <main className="app-main app-main--store">
          <MyProductList
            selectedFilter={selectedFilter}
            onSelectFilter={setSelectedFilter}
            sort={productSort}
            onSelectSort={setProductSort}
            searchTerm={searchTerm}
            onAddToCart={addToCart}
            onSelectProduct={(product) => {
              navigateToView("product-details", product);
            }}
          />
        </main>
      )}
      {currentView === "product-details" && selectedProduct && (
        <ProductsDetailsView
          product={selectedProduct}
          currentUser={currentUser}
          onAddToCart={addToCart}
          onSelectProduct={(product) => navigateToView("product-details", product)}
        />
      )}
      {currentView === "cart" && (
        <CartView
          items={cartItems}
          isLoading={isCartLoading}
          onQuantityChange={updateCartQuantity}
          onRemove={(key) => void updateCartQuantity(key, 0)}
          onCheckout={() => navigateToView("checkout")}
        />
      )}
      {currentView === "checkout" && (
        <CheckoutView
          items={cartItems}
          onPlaceCashOnDeliveryOrder={async (details) => {
            const { orderId } = await supabaseService.placeCashOnDeliveryOrder(details);
            return orderId;
          }}
          onContinueShopping={() => {
            setCartItems([]);
            navigateToView("store");
          }}
        />
      )}
      {currentView === "orders" && <OrderHistoryView />}
      {currentView === "login" && (
        <LoginView
          onSwitchToSignup={() => navigateToView("signup")}
          onForgotPassword={() => navigateToView("forgot-password")}
          onSignedIn={() => void handleSignedIn()}
        />
      )}
      {currentView === "forgot-password" && (
        <ForgotPasswordView onBackToLogin={() => navigateToView("login")} />
      )}
      {currentView === "reset-password" && (
        <PasswordResetView onPasswordUpdated={() => navigateToView("store", null, true)} />
      )}
      {currentView === "signup" && (
        <SignupView
          onSwitchToLogin={() => navigateToView("login")}
          onSignedUp={() => void handleSignedIn()}
        />
      )}
      {currentView === "admin" && <AdminView />}
      {currentView === "profile" && currentUser && (
        <ProfileView
          user={currentUser}
          isStoreAdmin={isStoreAdmin}
          onOpenAdmin={() => navigateToView("admin")}
          onSignOut={() => {
            setCurrentUser(null);
            navigateToView("store", null, true);
          }}
        />
      )}
    </>
  );
}