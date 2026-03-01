"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import {
  PartyPopper,
  Camera,
  UtensilsCrossed,
  Palette,
  Sparkles,
  Building2,
  Mic2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { SiInstagram, SiTiktok, SiFacebook, SiLinkedin, SiX } from "react-icons/si";

const VENDOR_STEPS = [
  {
    step: 1,
    title: "Create Your Profile",
    description:
      "Set up your Eventtz profile with your services, pricing, portfolio, and availability",
  },
  {
    step: 2,
    title: "Get Discovered & Receive Bookings",
    description:
      "Clients searching for vendors in your category and location can find you, compare options, and send booking requests.",
  },
  {
    step: 3,
    title: "Confirm & Get Paid Securely",
    description:
      "Manage enquiries, confirm bookings, and receive secure payments — all in one place.",
  },
];

const CLIENT_STEPS = [
  {
    step: 1,
    title: "Search & Compare Vendors",
    description:
      "Browse verified UK vendors by category, location, reviews, and pricing.",
  },
  {
    step: 2,
    title: "Send Booking Requests",
    description:
      "Contact vendors directly through the platform and confirm availability.",
  },
  {
    step: 3,
    title: "Book with Confidence",
    description:
      "Secure your vendor, make protected payments, and manage everything in one place.",
  },
];

const WAITLIST_URL = "https://forms.gle/6c4Ezw5MNuQaYr238";

const CATEGORIES = [
  {
    name: "Photography",
    Icon: Camera,
    description: "Capture every moment",
    iconBg: "bg-amber-500",
    iconColor: "text-white",
  },
  {
    name: "Catering",
    Icon: UtensilsCrossed,
    description: "Food & drink for your event",
    iconBg: "bg-rose-500",
    iconColor: "text-white",
  },
  {
    name: "Decor & styling",
    Icon: Palette,
    description: "Transform your venue",
    iconBg: "bg-violet-500",
    iconColor: "text-white",
  },
  {
    name: "Makeup & hair",
    Icon: Sparkles,
    description: "Look your best",
    iconBg: "bg-fuchsia-500",
    iconColor: "text-white",
  },
  {
    name: "Venues",
    Icon: Building2,
    description: "Find the perfect space",
    iconBg: "bg-emerald-600",
    iconColor: "text-white",
  },
  {
    name: "Entertainment",
    Icon: Mic2,
    description: "DJs, bands & more",
    iconBg: "bg-sky-500",
    iconColor: "text-white",
  },
];

// Add more images to public/images (e.g. wedding.jpg, celebration.jpg, venue.jpg) and add to this array
const GALLERY_IMAGES = [
  { src: "/images/birthday1.jpg", alt: "Birthday celebration", eventName: "Birthdays" },
  { src: "/images/naming.jpg", alt: "Event moment", eventName: "Gender Reveals" },
  { src: "/images/office.jpg", alt: "Celebration", eventName: "Office Parties" },
  { src: "/images/wedding.jpg", alt: "Party", eventName: "Weddings" },
];

const FAQ_ITEMS = [
  {
    q: "What is Eventtz?",
    a: "Eventtz is a UK marketplace connecting people planning events with trusted vendors — photographers, caterers, decorators, makeup artists, venues, and more.",
  },
  {
    q: "When will Eventtz launch?",
    a: "We're in the final stages of building. Join the waitlist to be first to know and get early access when we go live.",
  },
  {
    q: "Is it free to join the waitlist?",
    a: "Yes. Joining the waitlist is free and puts you first in line for updates and early access.",
  },
  {
    q: "How do I list my business as a vendor?",
    a: "Once we launch, you'll be able to create a vendor profile, add your services and pricing, and start receiving booking requests. Join the waitlist to hear when vendor sign-ups open.",
  },
];

const SOCIAL_LINKS = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/eventtz_/",
    aria: "Eventtz on Instagram",
    Icon: SiInstagram,
    color: "text-primary",
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@eventtz?is_from_webapp=1&sender_device=pc",
    aria: "Eventtz on TikTok",
    Icon: SiTiktok,
    color: "text-primary",
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/profile.php?id=61588127226543",
    aria: "Eventtz on Facebook",
    Icon: SiFacebook,
    color: "text-primary",
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/eventtz/?lipi=urn%3Ali%3Apage%3Ad_flagship3_search_srp_all%3BKW%2FYdf5RREu1tgdsOnlkQg%3D%3D",
    aria: "Eventtz on LinkedIn",
    Icon: SiLinkedin,
    color: "text-primary",
  },
  {
    name: "Twitter",
    href: "https://x.com/eventtz",
    aria: "Eventtz on Twitter",
    Icon: SiX,
    color: "text-primary",
  },
];

export default function Landing() {
  const [howItWorksTab, setHowItWorksTab] = useState("vendor");
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCarouselIndex((i) => (i + 1) % GALLERY_IMAGES.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-page-bg text-slate-800">
      {/* Top Nav — minimal, glass, mobile responsive */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/40 bg-[#f5f2f8]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 sm:px-6 sm:py-2.5 lg:px-16">
          <a href="#" className="flex items-center shrink-0">
            <Image
              src="/images/eventtz-logo.png"
              alt="Eventtz"
              width={165}
              height={70}
              className="h-10 w-auto sm:h-12 md:h-14 lg:h-16"
              priority
              unoptimized
            />
          </a>
          <a
            href="#contact"
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 active:scale-[0.98] sm:px-5 sm:py-2.5"
          >
            Contact us
          </a>
        </div>
      </nav>

      {/* Hero — full viewport height */}
      <div className="flex min-h-screen flex-col">
        <section className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-4 pt-[72px] pb-6 sm:px-6 sm:pt-[76px] sm:pb-8 md:flex-row md:items-center md:justify-between md:gap-12 md:px-12 md:pt-[80px] lg:gap-16 lg:px-16">
          <div className="flex min-w-0 flex-1 flex-col justify-center text-left md:max-w-[70%] md:flex-[2]">
            <div className="mb-4 flex w-fit items-center gap-2 sm:mb-5 sm:gap-2.5">
              <span
                className="inline-flex rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 p-1.5"
                aria-hidden
              >
                <PartyPopper
                  className="h-4 w-4 sm:h-5 sm:w-5 text-white"
                  strokeWidth={2}
                />
              </span>
              <span className="text-sm font-medium text-slate-600 sm:text-base">
                Launching soon
              </span>
            </div>
            <h1 className="font-heading text-3xl font-semibold leading-[1.12] tracking-tight text-slate-900 sm:text-4xl sm:leading-[1.08] lg:text-5xl xl:text-6xl">
              Find and Book Trusted Event Vendors in the UK
            </h1>
            <p className="mt-3 text-base leading-snug text-slate-600 sm:mt-4 sm:text-lg lg:text-xl">
              Eventtz connects you to photographers, caterers, decorators, makeup artists and more — all in one seamless marketplace.
            </p>
            <div className="mt-5 flex flex-col gap-4 sm:mt-6 md:flex-row md:justify-start">
              <a
                href={WAITLIST_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3.5 text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98] sm:w-fit sm:px-8 sm:py-4"
              >
                Join the Waitlist
              </a>
            </div>
          </div>

          <div className="relative mt-6 w-full max-w-[340px] flex-shrink-0 overflow-hidden rounded-2xl sm:mt-8 sm:max-w-[400px] md:mt-0 md:max-w-[480px] lg:max-w-[540px] xl:max-w-[600px]">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-2xl shadow-slate-300/30 ring-1 ring-slate-200/60">
              <Image
                src="/images/birthday.jpg"
                alt="Birthday celebration"
                width={1000}
                height={600}
                className="h-full w-full object-cover object-top"
                unoptimized
              />
            </div>
          </div>
        </section>
      </div>

      {/* Image gallery — auto-moving carousel, viewport section */}
      <section className="relative flex min-h-screen flex-col justify-center border-t border-slate-200/60 bg-white/30 px-4 py-12 pb-20 sm:px-6 sm:py-16 sm:pb-24">
        <div className="mx-auto w-full max-w-6xl flex-1 flex flex-col justify-center">
          <h2 className="font-heading text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Event Types
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-slate-600 sm:text-lg">
            Real events, real vendors — see what’s possible.
          </p>
          <div className="mx-auto mt-6 w-full max-h-[58vh] aspect-[4/3] sm:mt-8">
            <div className="h-full overflow-hidden rounded-2xl">
              <div
                className="flex h-full transition-transform duration-500 ease-out"
                style={{
                  transform: `translateX(${(12.5 - 75 * carouselIndex) / 3}%)`,
                  width: `${GALLERY_IMAGES.length * 75}%`,
                }}
              >
                {GALLERY_IMAGES.map((img, i) => {
                  const n = GALLERY_IMAGES.length;
                  const isLeftNeighbor = i === (carouselIndex - 1 + n) % n;
                  const isRightNeighbor = i === (carouselIndex + 1) % n;
                  const isSideImage = isLeftNeighbor || isRightNeighbor;
                  return (
                    <div
                      key={i}
                      className={`flex h-full shrink-0 items-center transition-all duration-300 ${
                        isSideImage ? "opacity-90" : ""
                      }`}
                      style={{
                        width: `${100 / GALLERY_IMAGES.length}%`,
                        paddingLeft: "0.5rem",
                        paddingRight: "0.5rem",
                      }}
                    >
                      <div className="flex h-full w-full flex-col gap-2">
                        <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl shadow-md ring-1 ring-slate-200/60">
                          <Image
                            src={img.src}
                            alt={img.alt}
                            fill
                            className={`object-cover object-center transition-all duration-300 ${
                              isSideImage ? "blur-[8px] scale-105" : ""
                            }`}
                            sizes="(max-width: 1152px) 100vw, 1152px"
                            unoptimized
                          />
                        </div>
                        <p className="text-center text-sm font-medium text-slate-700 sm:text-base">
                          {img.eventName}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-center gap-5 pb-2 sm:mt-8 sm:gap-8 sm:pb-4">
              <button
                type="button"
                onClick={() =>
                  setCarouselIndex((i) =>
                    i === 0 ? GALLERY_IMAGES.length - 1 : i - 1,
                  )
                }
                aria-label="Previous slide"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#f5f2f8]"
              >
                <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
              </button>
              <div className="flex gap-2">
                {GALLERY_IMAGES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCarouselIndex(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    className={`h-2.5 rounded-full transition-all ${
                      i === carouselIndex
                        ? "w-7 bg-primary"
                        : "w-2.5 bg-slate-400 hover:bg-slate-500"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setCarouselIndex((i) =>
                    i === GALLERY_IMAGES.length - 1 ? 0 : i + 1,
                  )
                }
                aria-label="Next slide"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#f5f2f8]"
              >
                <ChevronRight className="h-6 w-6" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* How it works — premium card and segmented control */}
      <section
        id="how-it-works"
        className="relative py-16 sm:py-20 md:py-24 lg:py-32"
      >
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-16">
          <h2 className="font-heading text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
            How it works
          </h2>

          {/* Segmented control*/}
          <div className="mt-8 flex rounded-full border border-slate-200/60 bg-page-bgs sm:mt-12">
            <button
              type="button"
              onClick={() => setHowItWorksTab("vendor")}
              className={`flex-1 rounded-full py-2.5 text-xs font-medium transition sm:py-3 sm:text-sm md:text-base ${
                howItWorksTab === "vendor"
                  ? "bg-primary text-white shadow-sm"
                  : "bg-page text-slate-600 hover:text-slate-800"
              }`}
            >
              For Vendors
            </button>
            <button
              type="button"
              onClick={() => setHowItWorksTab("client")}
              className={`flex-1 rounded-full py-2.5 text-xs font-medium transition sm:py-3 sm:text-sm md:text-base ${
                howItWorksTab === "client"
                  ? "bg-primary text-white shadow-sm"
                  : "bg-page text-slate-600 hover:text-slate-800"
              }`}
            >
              For Clients
            </button>
          </div>

          <p className="mt-4 text-center text-sm text-slate-600 sm:mt-6 sm:text-base">
            {howItWorksTab === "vendor"
              ? "How Eventtz Works for Vendors"
              : "How Eventtz Works for Clients"}
          </p>

          {/* Premium step cards */}
          <div className="mt-6 space-y-3 sm:mt-8 sm:space-y-4">
            {(howItWorksTab === "vendor" ? VENDOR_STEPS : CLIENT_STEPS).map(
              (item) => (
                <div
                  key={`${howItWorksTab}-${item.step}`}
                  className="rounded-2xl bg-white p-4 shadow-sm sm:p-6 md:p-8"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:gap-5 md:gap-6">
                    <div className="flex min-w-0 items-center gap-3 sm:flex-col sm:items-start sm:gap-0">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white sm:h-12 sm:w-12 sm:text-base">
                        {item.step}
                      </span>
                      <h3 className="font-heading text-base font-semibold text-slate-900 sm:hidden sm:text-lg md:text-xl">
                        {item.title}
                      </h3>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-heading hidden text-base font-semibold text-slate-900 sm:block sm:text-lg md:text-xl">
                        {item.title}
                      </h3>
                      <p className="mt-1.5 text-sm text-slate-600 leading-relaxed sm:mt-2 sm:text-base">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      {/* Categories — find vendors for every occasion */}
      <section className="relative border-t border-slate-200/60 bg-white/40 py-10 sm:py-16 sm:px-4 md:py-20 md:px-6 lg:py-24 lg:px-16">
        <div className="mx-auto max-w-6xl px-3 xs:px-4">
          <h2 className="font-heading text-center text-xl font-semibold tracking-tight text-slate-900 xs:text-2xl sm:text-3xl md:text-4xl">
            Find vendors for every occasion
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-slate-600 xs:mt-3 xs:text-base sm:mt-4 sm:text-lg">
            From weddings and birthdays to corporate events — browse by category
            and discover the right fit.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-3 xs:grid-cols-2 xs:gap-4 sm:mt-10 sm:gap-5 md:grid-cols-3 md:gap-6">
            {CATEGORIES.map(({ name, Icon, description, iconBg, iconColor }) => (
              <div
                key={name}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md active:scale-[0.99] xs:p-5 sm:p-6"
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${iconBg} ${iconColor}`}
                >
                  <Icon
                    className="h-5 w-5 sm:h-6 sm:w-6"
                    strokeWidth={1.5}
                  />
                </div>
                <h3 className="font-heading mt-3 text-base font-semibold text-slate-900 xs:mt-4 sm:text-lg">
                  {name}
                </h3>
                <p className="mt-1 text-sm leading-snug text-slate-600 xs:mt-1.5">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative border-t border-slate-200/60 bg-white/40 py-16 sm:py-20 md:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-16">
          <h2 className="font-heading text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
            Frequently asked questions
          </h2>
          <div className="mt-10 space-y-2 sm:mt-12">
            {FAQ_ITEMS.map((item, index) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenFaqIndex(openFaqIndex === index ? null : index)
                  }
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-slate-900 transition hover:bg-slate-50/80 sm:px-6 sm:py-4 sm:text-base"
                >
                  {item.q}
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-500 transition ${openFaqIndex === index ? "rotate-180" : ""}`}
                    strokeWidth={1.5}
                  />
                </button>
                {openFaqIndex === index && (
                  <div className="border-t border-slate-100 px-5 py-4 sm:px-6 sm:py-4">
                    <p className="text-sm text-slate-600 leading-relaxed sm:text-base">
                      {item.a}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact — calm, premium CTA */}
      <section
        id="contact"
        className="border-t border-slate-200/60 bg-white/50 py-16 sm:py-20 md:py-24 lg:py-32"
      >
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-16">
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
            Coming Soon
          </h2>
          <p className="mt-3 text-slate-600 leading-relaxed sm:mt-4 sm:text-lg">
            Built with real vendors. Designed for better bookings.
          </p>
          <a
            href={WAITLIST_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3.5 text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98] sm:mt-8 sm:w-auto sm:px-8 sm:py-4"
          >
            Join the waitlist
          </a>
        </div>
      </section>

      {/* Footer — social links */}
      <footer className="border-t border-slate-200/60 bg-white/30 py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-16">
          <p className="text-center text-xs text-slate-500 sm:text-sm">
            Follow us
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-5 sm:gap-6">
            {SOCIAL_LINKS.map(({ name, href, aria, Icon, color }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={aria}
                className={`rounded-full p-2.5 transition hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#f5f2f8] ${color}`}
              >
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
