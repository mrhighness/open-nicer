/** Shared product copy — About page, README, and meta tags stay in sync. */

export const PRODUCT = {
  name: "Open Nicer",
  /** Default profile status + invite link share message */
  inviteShareText: "Hey there! I am using Open Nicer. Let's talk here!",
  tagline: "Instant messaging, no sign-up required.",
  shortDescription:
    "A beautiful, free, open-source chat app. Open it, get an instant identity, and message anyone in real time — on phone or desktop.",
  license: "MIT",
  logoUrl: "/open-nicer.png",
  nicleLogoUrl: "/nicle-logo.png",
  website: "https://allthingswebtech.com",
  companyWebsite: "https://www.allthingswebtechnology.com/",
  atwTrademarkUrl: "/tresdmark.png",
  supportUrl: "https://www.paypal.com/ncp/payment/2U7GGN9MP7KQW",
  footerAttribution:
    "Free & open source (MIT) · Nicle Inc. · All Things Web Technology Inc. developed by Highness Chinedu known as (Mr. Highness HC)",
  author: {
    name: "Mr. Highness Chinedu",
    alias: "Mr. Highness HC",
    title: "Founder & CEO",
    email: "mivasiondb@gmail.com",
  },
  organizations: [
    { name: "Nicle Inc.", role: "Open-source product steward" },
    { name: "All Things Web Technology Inc.", role: "Engineering & design" },
  ],
} as const;

export const PRODUCT_SPEC = {
  whatItIs: [
    "Open Nicer is a modern, mobile-first web messaging application.",
    "It is released to the world as free and open-source software — anyone can use, study, modify, and ship it.",
    "There are no accounts or passwords to create: your device gets an instant profile so you can chat immediately.",
  ],
  whoItIsFor: [
    "Developers learning real-time web apps",
    "Teams wanting a lightweight chat UI to fork and customize",
    "Anyone who wants a polished messenger without sign-up friction",
    "Communities that need a simple, self-hostable chat experience",
  ],
  features: [
    { title: "No sign-up", detail: "Instant profile on first visit — start chatting in seconds." },
    { title: "Real-time DMs", detail: "Messages, reactions, and read state sync live across devices." },
    { title: "Rich messaging", detail: "Photos, video, voice notes, files, stickers, swipe-to-reply, and emoji reactions." },
    { title: "Voice & video calls", detail: "WebRTC audio and video calling with a polished in-app UI." },
    { title: "Privacy controls", detail: "Hide from discovery, control who can message you, and manage online visibility." },
    { title: "Unread badges", detail: "Red notification counts on chats and the tab bar when you have new messages." },
    { title: "Security-minded", detail: "Row-level access rules, input validation, upload limits, and secure session options." },
    { title: "Beautiful UI", detail: "Purple/magenta dark theme, smooth animations, desktop and mobile layouts." },
  ],
  techStack: [
    "React 19 + TanStack Start",
    "Tailwind CSS v4 + Framer Motion",
    "Supabase (Postgres, Realtime, Storage, Auth)",
    "WebRTC for calls",
    "Deployable to Cloudflare Workers",
  ],
} as const;

export const OPEN_SOURCE_STATEMENT =
  "Open Nicer is open-source software from Nicle Inc., presented by All Things Web Technology Inc. Mr. Highness Chinedu (Mr. Highness HC) released this project to the world — free for everyone to use, copy, fork, and build upon.";

/** Brand mark for headers: "Open" + highlighted "Nicer" */
export const BRAND = {
  lead: "Open",
  accent: "Nicer",
} as const;
