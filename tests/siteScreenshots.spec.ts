import { test } from "@playwright/test";
import { argosScreenshot } from "@argos-ci/playwright";
import * as fs from "fs";
import * as cheerio from "cheerio";

const siteUrl =
  process.env.SITE_URL ??
  "https://deploy-preview-3780--react-native.netlify.app";

function extractSitemapUrls() {
  const sitemapString = fs.readFileSync("./sitemap.xml") as any;
  const $ = cheerio.load(sitemapString, { xmlMode: true });
  const urls: string[] = [];
  $("loc").each(function () {
    urls.push($(this).text());
  });
  return urls;
}

const BlacklistedPathnames: string[] = [
  // TODO
];

function isBlacklisted(pathname: string) {
  return (
    // skip versioned docs
    pathname.match(/^\/docs\/(\d\.\d\d)|(next)\//) ||
    // manually excluded urls
    BlacklistedPathnames.includes(pathname)
  );
}

const getPathnames = function (): string[] {
  const urls = extractSitemapUrls();
  const pathnamesUnfiltered = urls.map((url) => new URL(url).pathname);
  const pathnames = pathnamesUnfiltered.filter(
    (pathname) => !isBlacklisted(pathname)
  );
  pathnames.sort();
  console.log("Pathnames:\n", JSON.stringify(pathnames, null, 2));
  console.log("Pathnames before filtering", pathnamesUnfiltered.length);
  console.log("Pathnames after filtering", pathnames.length);
  return pathnames;
};

// Hide elements that may vary between prod/preview
const stylesheet = `
/* Global + Docusaurus theme flaky elements */
iframe, 
.theme-last-updated,
.avatar__photo,
.DocSearch-Button-Keys,
img[src$=".gif"] {
  visibility: hidden;
}


/* React-Native Website flaky elements */

/* Prevents layout shift in https://reactnative.dev/blog/2019/11/18/react-native-doctor */
video {
  visibility: hidden;
  aspect-ratio: 16/9;
}

/* Disable logo animation on homepage https://reactnative.dev/ */
svg.LogoAnimation {
  visibility: hidden;
}

/* Showcase customers are randomized on https://reactnative.dev/showcase */
div.showcaseCustomers {
  display: none;
}

/* Hide SurveyMonkey widgets (note: you can force show them with QS: ?smcx_force_show ) */
div#__smcx__, 
div.smcx-widget, 
div.smcx-modal {
  visibility: hidden !important;
}

`;

function pathnameToArgosName(pathname: string): string {
  function removeTrailingSlash(str: string): string {
    return str.endsWith("/") ? str.slice(0, -1) : str;
  }
  function removeLeadingSlash(str: string): string {
    return str.startsWith("/") ? str.slice(1) : str;
  }

  pathname = removeTrailingSlash(pathname);
  pathname = removeLeadingSlash(pathname);

  if (pathname === "") {
    return "index";
  }

  return pathname;
}

function createPathnameTest(pathname: string) {
  test(`pathname ${pathname}`, async ({ page }) => {
    const url = siteUrl + pathname;
    await page.goto(url);
    await page.addStyleTag({ content: stylesheet });
    // await expect(page).toHaveScreenshot({ fullPage: true, ...options });
    await argosScreenshot(page, pathnameToArgosName(pathname));
  });
}

test.describe("site screenshots", () => {
  const pathnames = getPathnames();

  pathnames.forEach(createPathnameTest);
});
