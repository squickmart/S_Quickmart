importScripts("https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyD1qOrie6i62ThyR0oeZtAomJbeYQwjMh4",
  authDomain: "quickmart-b117e.firebaseapp.com",
  projectId: "quickmart-b117e",
  storageBucket: "quickmart-b117e.firebasestorage.app",
  messagingSenderId: "128330058901",
  appId: "1:128330058901:web:2bbd1eae9231308ef79f9c"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const title = payload.notification.title || "🛒 New Order — S_Quick Mart";
  const options = {
    body: payload.notification.body || "A new order has been placed. Open app to assign delivery.",
    icon: "/icon.png",
    badge: "/icon.png",
    vibrate: [300, 100, 300, 100, 300],
    tag: "new-order",
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: "open", title: "View Order" }
    ]
  };
  self.registration.showNotification(title, options);
});