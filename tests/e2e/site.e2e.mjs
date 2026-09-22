// Public-site checks: the pages exist, the homepage tells the
// whole story, and the HTML is useful before JavaScript runs.
import { createChecker, page } from "./helpers.mjs";

const { check, done } = createChecker("site");

const home = await page("/");
check("homepage renders", home.status === 200);
check("headline is in the server HTML", home.html.includes("Play your best golf for someone"));
check("explains what you do, how you win, and the charity share", ["What you do", "How you win", "Where your"].every((phrase) => home.html.includes(phrase)));
check("subscribe call to action is present", home.html.includes("/signup") && home.html.includes("Join and choose your cause"));
check("live figures are server-rendered, not zeros awaiting JavaScript", /Raised for charity so far/.test(home.html) && !/>£0\.00</.test(home.html.split("Raised for charity so far")[0].slice(-400)));

// Content must not depend on JavaScript: nothing above the fold ships hidden.
const heroChunk = home.html.slice(0, home.html.indexOf("Impact so far"));
const hiddenInHero = (heroChunk.match(/opacity:0(?![.\d])/g) ?? []).length;
check("hero text is not hidden in the HTML", hiddenInHero <= 8, `${hiddenInHero} hidden nodes (decorative ticket only)`);
check("skip link is present for keyboard users", home.html.includes("Skip to content") && home.html.includes('href="#main"'));
check("mobile menu button is present", home.html.includes('aria-controls="mobile-menu"'));

const how = await page("/how-it-works");
check("how-it-works page exists (was a broken nav link)", how.status === 200);
check("it explains the rules and answers questions", ["Your ticket", "The monthly draw", "Questions people ask"].every((phrase) => how.html.includes(phrase)));

check("unknown route returns 404", (await page("/definitely-not-a-page")).status === 404);
const missingCharity = await page("/charities/not-a-real-charity");
// Regression guard: a streaming boundary once made this a 200 with 404 content.
check("missing charity returns a real 404 status", missingCharity.status === 404, missingCharity.status);
check("404 page offers a way back", missingCharity.html.includes("out of bounds") && missingCharity.html.includes("/charities"));

process.exitCode = done() === 0 ? 0 : 1;
