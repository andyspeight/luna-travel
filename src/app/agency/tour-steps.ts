/**
 * What the agency walkthrough says, and what it points at.
 *
 * Separated from the component so it is plain data: the copy can be edited
 * without touching the tour's behaviour, and tour-steps.test.ts can import it
 * to check that every anchor it names still exists.
 *
 * That check earns its place: an attribute-anchored tour fails SILENTLY when a
 * page is renamed or a nav key changes. The spotlight simply stops appearing,
 * nothing throws, and nobody notices until an agency mentions it months later.
 */

import type { TourStep } from '@/components/coach-tour';

export const STEPS: TourStep[] = [
  {
    title: 'Welcome to Luna Travel',
    body:
      "Your travellers get your own branded app for their trip — tickets, documents, flight times and a direct line to you. This is where you set it up and run it. Two minutes and you'll know your way around.",
  },
  {
    target: 'nav-overview',
    title: 'Overview is your morning check',
    body:
      'Who is travelling soon, who has opened their app, and anything waiting on you. Start here each day.',
  },
  {
    href: '/agency/branding',
    target: 'branding-intro',
    title: 'First job: make it yours',
    body:
      'Your name, your colours, your logo, your welcome message. The phone on the right re-skins as you type. Travellers never see the word Travelgenix — as far as they are concerned this is your app.',
  },
  {
    href: '/agency/access',
    target: 'access-intro',
    title: 'This is how a traveller gets in',
    body:
      'Enter the booking reference, the email on the booking and the departure date, and we create a link and QR code to send them. We check the booking really is reachable before the link is created, so you find out here rather than your customer finding out later.',
  },
  {
    target: 'access-list',
    title: 'See what happened to every link',
    body:
      'Sent, opened, or redeemed. If a traveller says they never got in, look here first. You can revoke a link at any time.',
  },
  {
    target: 'nav-travellers',
    title: 'Travellers appear here once they are in',
    body:
      'Everyone on a booking can use the same link and each gets their own record — so a couple shows as two people, and you can see who has actually opened the app rather than just "someone has".',
  },
  {
    target: 'nav-messages',
    title: 'Talk to them directly',
    body:
      'Message a traveller in the app and they can reply. It arrives as a push notification on their phone, which beats an email they will not read at an airport. Replies also land in your inbox.',
  },
  {
    target: 'nav-documents',
    title: 'Add anything the booking does not carry',
    body:
      'Tickets and vouchers from the booking are already there. Use this for the extras — insurance, visa letters, a parking confirmation. They open in the app and work offline once viewed.',
  },
  {
    target: 'nav-content',
    title: 'Trip pages are your own touch',
    body:
      'Write a note about the resort, add your recommendations, pin places on the map. This is where a booking stops feeling like a receipt.',
  },
  {
    target: 'nav-settings',
    title: 'One setting worth doing now',
    body:
      'Set the email address traveller replies should go to. Without it we guess from whoever sent the invite, which is rarely the right desk.',
  },
  {
    title: "That's the tour",
    body:
      'Brand the app, send one traveller a link, and you are live. The full setup guide is under Guide in the menu, and this walkthrough is always in the corner if you want it again.',
  },
];
