import { View } from "../types";

export interface PageSeoMetadata {
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  twitterTitle: string;
  twitterDescription: string;
}

export const seoMetadataMap: Record<View, PageSeoMetadata> = {
  home: {
    title: "Overview",
    description: "Welcome to Ceaznet - Your all-in-one personalized dashboard for notes, finance tracking, live translation, chemistry molecule analysis, and real-time smart tools.",
    keywords: "ceaznet, dashboard, overview, personal manager, smart tools, productivity, hub",
    ogTitle: "Ceaznet Overview - Personal Smart Dashboard",
    ogDescription: "Manage your daily activities, track finances, organize notes, explore curated news, and access powerful AI-powered utilities in one elegant interface.",
    twitterTitle: "Ceaznet Overview - Personal Smart Dashboard",
    twitterDescription: "Manage your daily activities, track finances, organize notes, and access powerful AI-powered utilities in one elegant interface."
  },
  explore: {
    title: "Explore",
    description: "Explore highly curated news, trending articles, global topics, and custom content feeds tailored to your interests and preferences.",
    keywords: "explore, news, articles, global updates, curated feed, reading list, insights",
    ogTitle: "Explore Global News & Curated Articles | Ceaznet",
    ogDescription: "Stay informed with real-time updates across technology, science, business, health, and entertainment on Ceaznet.",
    twitterTitle: "Explore Global News & Curated Articles | Ceaznet",
    twitterDescription: "Stay informed with real-time updates across technology, science, business, health, and entertainment on Ceaznet."
  },
  "article-reader": {
    title: "Article Reader",
    description: "Immersive reading mode. Enjoy a clean, distraction-free environment for deep-diving into news articles and rich text content.",
    keywords: "reader, article reader, clean reading, distraction-free, text reader, book reader",
    ogTitle: "Distraction-Free Article Reader | Ceaznet",
    ogDescription: "Read your favorite news and articles with a comfortable typography, adjustable font sizes, and reader mode.",
    twitterTitle: "Distraction-Free Article Reader | Ceaznet",
    twitterDescription: "Read your favorite news and articles with a comfortable typography, adjustable font sizes, and reader mode."
  },
  notes: {
    title: "Notes",
    description: "Write, organize, search, and manage your thoughts and notes seamlessly with our advanced local markdown editor.",
    keywords: "notes, notebooks, editor, markdown editor, checklist, tasks, organize, thoughts",
    ogTitle: "Personal Notes & Markdown Editor | Ceaznet",
    ogDescription: "Keep your ideas organized, format notes with markdown, and search through your digital journal effortlessly on Ceaznet.",
    twitterTitle: "Personal Notes & Markdown Editor | Ceaznet",
    twitterDescription: "Keep your ideas organized, format notes with markdown, and search through your digital journal effortlessly on Ceaznet."
  },
  finance: {
    title: "Finance",
    description: "Track your income, expenses, budgets, savings, and financial logs with rich interactive charts and smart statistics.",
    keywords: "finance, expense tracker, budget planner, savings, money manager, financial analysis, charts",
    ogTitle: "Smart Finance Tracker & Budget Planner | Ceaznet",
    ogDescription: "Monitor your spending patterns, analyze budgets with visual charts, and take control of your financial freedom on Ceaznet.",
    twitterTitle: "Smart Finance Tracker & Budget Planner | Ceaznet",
    twitterDescription: "Monitor your spending patterns, analyze budgets with visual charts, and take control of your financial freedom on Ceaznet."
  },
  dairy: {
    title: "Dairy",
    description: "Your safe personal dairy and daily journal space. Reflect on your days, capture memories, track moods, and secure your thoughts.",
    keywords: "dairy, journal, daily logs, private diary, memories, mood tracker, reflection, writing",
    ogTitle: "Secure Personal Journal & Daily Diary | Ceaznet",
    ogDescription: "Document your life journey, express your thoughts, and keep a beautiful private journal with local encryption on Ceaznet.",
    twitterTitle: "Secure Personal Journal & Daily Diary | Ceaznet",
    twitterDescription: "Document your life journey, express your thoughts, and keep a beautiful private journal with local encryption on Ceaznet."
  },
  gallery: {
    title: "Gallery",
    description: "Browse, view, upload, and organize your media, photos, and visual collections in a beautiful, responsive grid layout.",
    keywords: "gallery, media gallery, photos, image viewer, albums, uploads, visual collection",
    ogTitle: "Media Gallery & Visual Collection | Ceaznet",
    ogDescription: "View and organize your images, photos, and custom visuals in a high-performance grid gallery.",
    twitterTitle: "Media Gallery & Visual Collection | Ceaznet",
    twitterDescription: "View and organize your images, photos, and custom visuals in a high-performance grid gallery."
  },
  translator: {
    title: "Translate",
    description: "Translate text instantly across dozens of world languages with our precise, context-aware AI translation service.",
    keywords: "translator, machine translation, speech to text, multilingual translate, language learning, chat translate",
    ogTitle: "Instant Multi-Language Translator | Ceaznet",
    ogDescription: "Break down language barriers with fast, accurate translations across standard and custom dialects using Ceaznet.",
    twitterTitle: "Instant Multi-Language Translator | Ceaznet",
    twitterDescription: "Break down language barriers with fast, accurate translations across standard and custom dialects using Ceaznet."
  },
  "molecule-viewer": {
    title: "Molecule Viewer",
    description: "Interactive 3D chemical molecule viewer. Analyze atomic configurations, bond lengths, structures, and chemical formulas.",
    keywords: "molecule, chemical structure, 3d molecule viewer, organic chemistry, molecular bonds, periodic table, science education",
    ogTitle: "Interactive 3D Molecule & Chemical Structure Viewer | Ceaznet",
    ogDescription: "Explore interactive 3D renderings of complex chemical compounds and molecules for scientific learning and analysis.",
    twitterTitle: "Interactive 3D Molecule & Chemical Structure Viewer | Ceaznet",
    twitterDescription: "Explore interactive 3D renderings of complex chemical compounds and molecules for scientific learning and analysis."
  },
  "live-conversation": {
    title: "Live Conversation",
    description: "Engage in voice-driven, interactive, real-time audio chat with smart voice personas and AI translation systems.",
    keywords: "live chat, voice chat, voice persona, speech synthesis, real-time voice, interactive conversation, chat assistant",
    ogTitle: "Real-Time Smart Voice & Live Conversation | Ceaznet",
    ogDescription: "Speak naturally and experience low-latency, real-time voice conversations with fully customized AI companion personas.",
    twitterTitle: "Real-Time Smart Voice & Live Conversation | Ceaznet",
    twitterDescription: "Speak naturally and experience low-latency, real-time voice conversations with fully customized AI companion personas."
  },
  settings: {
    title: "Settings",
    description: "Customize your dashboard experience, typography, font family, border-radii, active themes, and manage user API credentials.",
    keywords: "settings, preferences, theme customization, api credentials, user profile, configurations, setup",
    ogTitle: "App Settings & Theme Preferences | Ceaznet",
    ogDescription: "Configure your user interface preferences, adjust border radius, choose fonts, manage light/dark mode, and authorize API integrations.",
    twitterTitle: "App Settings & Theme Preferences | Ceaznet",
    twitterDescription: "Configure your user interface preferences, adjust border radius, choose fonts, manage light/dark mode, and authorize API integrations."
  },
  about: {
    title: "About",
    description: "Learn more about the architectural foundation of Ceaznet, its serverless structure, modern frontend, and the team behind it.",
    keywords: "about us, architectural foundation, serverless system, project details, tech stack, ceaznet documentation",
    ogTitle: "About Ceaznet - Architecture & Platform Stack | Ceaznet",
    ogDescription: "Discover how Ceaznet utilizes serverless edge functions, high-performance local storage, and client-side processing.",
    twitterTitle: "About Ceaznet - Architecture & Platform Stack | Ceaznet",
    twitterDescription: "Discover how Ceaznet utilizes serverless edge functions, high-performance local storage, and client-side processing."
  },
  features: {
    title: "Features",
    description: "Discover the extensive range of tools, widgets, and capabilities offered by the Ceaznet web application.",
    keywords: "features, tools, utilities, widgets, applications, ceaznet capabilities, system overview",
    ogTitle: "Features & Interactive Core Modules | Ceaznet",
    ogDescription: "Learn more about notes, finance charts, 3D molecules, speech capabilities, and all interactive features inside Ceaznet.",
    twitterTitle: "Features & Interactive Core Modules | Ceaznet",
    twitterDescription: "Learn more about notes, finance charts, 3D molecules, speech capabilities, and all interactive features inside Ceaznet."
  },
  "privacy-policy": {
    title: "Privacy Policy",
    description: "Your privacy is paramount. Read the Ceaznet privacy policy to understand how your local data remains secure and private.",
    keywords: "privacy policy, data safety, secure storage, local encryption, privacy commitment, terms",
    ogTitle: "Privacy Policy & Local Data Commitment | Ceaznet",
    ogDescription: "Read about how Ceaznet prioritizes user privacy by storing sensitive records directly on your local device.",
    twitterTitle: "Privacy Policy & Local Data Commitment | Ceaznet",
    twitterDescription: "Read about how Ceaznet prioritizes user privacy by storing sensitive records directly on your local device."
  },
  "terms-of-service": {
    title: "Terms of Service",
    description: "Review the terms, rules, and guidelines for accessing and utilizing the various features of Ceaznet.",
    keywords: "terms of service, terms of use, legal notice, guidelines, user agreement, policies",
    ogTitle: "Terms of Service & Usage Guidelines | Ceaznet",
    ogDescription: "Understand the terms and conditions that govern the usage of the Ceaznet application platform.",
    twitterTitle: "Terms of Service & Usage Guidelines | Ceaznet",
    twitterDescription: "Understand the terms and conditions that govern the usage of the Ceaznet application platform."
  },
  "voice-history": {
    title: "Voice History",
    description: "Browse your historical vocal transcripts, past conversations, voice notes, and saved chat logs.",
    keywords: "voice history, voice logs, transcripts, past conversations, recorded voice, history tracking",
    ogTitle: "Voice Interaction History & Chat Transcripts | Ceaznet",
    ogDescription: "Access your previous vocal communication records, search through conversations, and keep trace of your interactive sessions.",
    twitterTitle: "Voice Interaction History & Chat Transcripts | Ceaznet",
    twitterDescription: "Access your previous vocal communication records, search through conversations, and keep trace of your interactive sessions."
  },
  "voice-settings": {
    title: "Voice Settings",
    description: "Configure your voice model parameters, speaking speeds, accents, model selections, and custom persona options.",
    keywords: "voice settings, audio configuration, text to speech speeds, model preferences, vocal customization",
    ogTitle: "Voice Customization & Audio Settings | Ceaznet",
    ogDescription: "Adjust voice synthesizers, model parameters, and configure active conversational companion settings on Ceaznet.",
    twitterTitle: "Voice Customization & Audio Settings | Ceaznet",
    twitterDescription: "Adjust voice synthesizers, model parameters, and configure active conversational companion settings on Ceaznet."
  },
  support: {
    title: "Support",
    description: "Need help? Contact support, submit suggestions, read FAQs, and connect with help resources on Ceaznet.",
    keywords: "support, user assistance, ticket help, suggestions, system feedback, developer contact, faq",
    ogTitle: "Help Desk & Customer Support Hub | Ceaznet",
    ogDescription: "Get fast answers to your questions, troubleshooting steps, and direct developers' support here.",
    twitterTitle: "Help Desk & Customer Support Hub | Ceaznet",
    twitterDescription: "Get fast answers to your questions, troubleshooting steps, and direct developers' support here."
  },
  profile: {
    title: "User Profile & Security",
    description: "Manage your account, view security sessions and devices, update themes and profile details.",
    keywords: "profile, account, settings, security, devices, sessions, preferences",
    ogTitle: "User Profile & Security | Ceaznet",
    ogDescription: "Manage your account, view security sessions and devices, update themes and profile details.",
    twitterTitle: "User Profile & Security | Ceaznet",
    twitterDescription: "Manage your account, view security sessions and devices, update themes and profile details."
  },
  "shared-note": {
    title: "Shared Note",
    description: "View shared notes anonymously on Ceaznet.",
    keywords: "shared note, public note, notes link, ceaznet note",
    ogTitle: "Shared Note | Ceaznet",
    ogDescription: "View shared markdown notes and thoughts securely and anonymously on Ceaznet.",
    twitterTitle: "Shared Note | Ceaznet",
    twitterDescription: "View shared markdown notes and thoughts securely and anonymously on Ceaznet."
  },
  "not-found": {
    title: "Page Not Found",
    description: "The requested page was not found or has been moved. Return to safety or head back to the dashboard overview.",
    keywords: "404, page not found, route error, missing page, redirection, dashboard overview",
    ogTitle: "404 Page Not Found | Ceaznet",
    ogDescription: "The page you are looking for does not exist. Please return to the overview page.",
    twitterTitle: "404 Page Not Found | Ceaznet",
    twitterDescription: "The page you are looking for does not exist. Please return to the overview page."
  }
};

function setMetaTag(nameOrProperty: string, content: string, isProperty = false) {
  if (typeof document === "undefined") return;
  const attributeName = isProperty ? "property" : "name";
  let element = document.querySelector(`meta[${attributeName}="${nameOrProperty}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attributeName, nameOrProperty);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function setLinkTag(rel: string, href: string) {
  if (typeof document === "undefined") return;
  let element = document.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

export function updatePageMetadata(view: View, pathname: string) {
  if (typeof document === "undefined") return;

  const metadata = seoMetadataMap[view] || seoMetadataMap["not-found"];

  // 1. Title
  document.title = `${metadata.title} | Ceaznet`;

  // 2. Standard Description and Keywords
  setMetaTag("description", metadata.description);
  setMetaTag("keywords", metadata.keywords);

  // 3. Open Graph
  const origin = window.location.origin;
  const fullUrl = origin + pathname;
  const logoUrl = origin + "/logo.png";

  setMetaTag("og:title", metadata.ogTitle, true);
  setMetaTag("og:description", metadata.ogDescription, true);
  setMetaTag("og:url", fullUrl, true);
  setMetaTag("og:image", logoUrl, true);
  setMetaTag("og:type", "website", true);

  // 4. Twitter / X Card
  setMetaTag("twitter:card", "summary");
  setMetaTag("twitter:title", metadata.twitterTitle);
  setMetaTag("twitter:description", metadata.twitterDescription);
  setMetaTag("twitter:image", logoUrl);

  // 5. Canonical Link
  setLinkTag("canonical", fullUrl);
}
