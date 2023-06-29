import { test } from "@playwright/test";
import { argosScreenshot } from "@argos-ci/playwright";
import * as fs from "fs";
import * as cheerio from "cheerio";

const siteUrl = process.env.SITE_URL ?? "https://reactnative.dev";

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
iframe, 
article.yt-lite, 
.theme-last-updated,
.avatar__photo,
img[src$=".gif"],
h2#using-jsx-markup ~ div > div[class*='browserWindowBody']:has(b),
[class*='playgroundPreview'] {
  visibility: hidden;
}

/* Footnotes rendering has changed in MDX v1 => v2: let's ignore footnotes completely */
.footnotes {
  display: none;
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
