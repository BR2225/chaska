let checkoutLoadPromise;

export function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve(true);
  if (checkoutLoadPromise) return checkoutLoadPromise;

  checkoutLoadPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[data-chaska-razorpay="checkout"]');
    const script = existing || document.createElement("script");

    const finish = (loaded) => {
      if (!loaded) checkoutLoadPromise = undefined;
      resolve(loaded);
    };

    script.addEventListener("load", () => finish(Boolean(window.Razorpay)), { once: true });
    script.addEventListener("error", () => finish(false), { once: true });

    if (!existing) {
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.dataset.chaskaRazorpay = "checkout";
      document.head.appendChild(script);
    }
  });

  return checkoutLoadPromise;
}
