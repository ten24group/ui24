import { Block, BlockNoteEditor } from "@blocknote/core";
import { dayjsCustom } from './dayjs';

export function isValidURL(str) {
  var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
    '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
  return !!pattern.test(str);
}

export function replaceAll(target: string, search: string, replacement: string) {
  return target.split(search).join(replacement);
}

export function addPathToUrl(baseURL: string, endpoint: string) {
  if (!isValidURL(baseURL)) {
    throw new Error(`Invalid base URL: ${baseURL}`);
  }

  // make sure base url ends with a slash and endpoint always starts with a slash `/` 
  if (!baseURL.endsWith('/')) {
    baseURL = `${baseURL}/`
  }

  // Make sure path does-not end with a trailing-slash `/` 
  // [AWS signature needs the exact path (with or without slash)]
  // And API gateway strips teh training slash from the API-endpoint
  // * we need to make sure that API, Auth-policy, and Frontend-code all follow the same convention
  endpoint = replaceAll(`./${endpoint}`, '//', '/');
  endpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;

  const newUrl = new URL(endpoint, baseURL);

  return newUrl.toString();
}

export function convertUTCDateToLocalDate(date: string | Date): Date {
  // Use dayjs to correctly handle UTC to local conversion
  return dayjsCustom.utc(date).local().toDate();
}

export async function getBlocksToHtml(blocks: Block[], editor?: BlockNoteEditor): Promise<string> {
  editor = editor || BlockNoteEditor.create({});

  const markup = await editor.blocksToHTMLLossy(blocks)

  return markup
}

export function isValidJson(str) {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

export const formatValue = (value: number | string | undefined, formatter?: (value: number | string) => string): string => {
  if (value === undefined || value === null) return '';
  return formatter ? formatter(value) : String(value);
};

export const truncateText = (text: string, maxLength: number = 100): string => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Substitutes URL parameters in a URL string with values from routeParams or fallback identifier
 * @param url - The URL with parameters like "/api/users/:id" or "/system/search/indices/:entityName"
 * @param routeParams - Object containing parameter values from route matching (e.g., {entityName: "syncStatus"})
 * @param fallbackIdentifier - Fallback value to use if parameter not found in routeParams
 * @returns URL with parameters substituted
 */
export const substituteUrlParams = (
  url: string, 
  routeParams: Record<string, string> = {}, 
  fallbackIdentifier?: string | number
): string => {
  // Check if we have route parameters or an identifier to work with
  const hasRouteParams = routeParams && Object.keys(routeParams).length > 0;
  
  if (!hasRouteParams && !fallbackIdentifier) {
    return url; // No substitution possible
  }

  // Check if URL has placeholders (like :entityName, :id, etc.)
  if (/:(\w+)/.test(url)) {
    // Use parameter substitution for URLs with placeholders
    return url.replace(/:(\w+)/g, (match, param) => {
      // First try to get the parameter from routeParams
      if (routeParams[param] !== undefined) {
        return routeParams[param];
      }
      // Fallback to using the identifier (if available)
      if (fallbackIdentifier !== undefined) {
        return String(fallbackIdentifier);
      }
      // If no value found, keep the placeholder (will likely cause an error)
      console.warn(`No value found for URL parameter ${param}`);
      return match;
    });
  } else if (fallbackIdentifier !== undefined) {
    // Legacy behavior: append identifier to URL (only if we have an identifier)
    return `${url}/${fallbackIdentifier}`;
  }

  return url;
};

