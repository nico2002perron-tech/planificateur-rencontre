export interface ScrapedLead {
  name: string;
  business_name: string;
  phone: string;
  address: string;
  city: string;
  profession: string;
}

function randomDelay(min: number, max: number): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanPhone(raw: string): string {
  return raw.replace(/[^0-9+]/g, '');
}

export async function scrapePagesJaunes(
  profession: string,
  city: string,
  maxResults: number = 50
): Promise<ScrapedLead[]> {
  const leads: ScrapedLead[] = [];
  const query = encodeURIComponent(profession);
  const location = encodeURIComponent(city + ' QC');
  let page = 1;

  while (leads.length < maxResults) {
    await randomDelay(3000, 8000);

    const url = `https://www.pagesjaunes.ca/search/si/${page}/${query}/${location}`;
    let html: string;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-CA,fr;q=0.9,en;q=0.8',
        },
      });
      if (!res.ok) break;
      html = await res.text();
    } catch {
      break;
    }

    // Extract listing blocks — Pages Jaunes uses class="listing" or "listing__content"
    const listingRegex = /<div[^>]*class="[^"]*listing[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
    const nameRegex = /<a[^>]*class="[^"]*listing__name[^"]*"[^>]*>([^<]+)<\/a>/;
    const phoneRegex = /data-phone="([^"]+)"|class="[^"]*mlr__item__cta[^"]*"[^>]*href="tel:([^"]+)"/;
    const addressRegex = /<span[^>]*class="[^"]*listing__address[^"]*"[^>]*>([^<]+)<\/span>/;

    // Fallback: extract all phone numbers and business names from the page
    const allPhones = html.match(/(?:data-phone="|href="tel:)([0-9()+\- ]{10,})/g) || [];
    const allNames = html.match(/<a[^>]*class="[^"]*listing__name--link[^"]*"[^>]*>([^<]+)<\/a>/g) || [];

    let match;
    let found = 0;
    const blocks = html.split(/class="[^"]*listing__content/);

    for (let i = 1; i < blocks.length && leads.length < maxResults; i++) {
      const block = blocks[i];
      const nameMatch = block.match(/>([^<]{3,60})<\/a>/);
      const phoneMatch = block.match(/(?:data-phone="|href="tel:)([0-9()+\- ]{10,})/);
      const addrMatch = block.match(/(?:listing__address[^>]*>|address[^>]*>)([^<]+)/);

      if (nameMatch && phoneMatch) {
        const phone = cleanPhone(phoneMatch[1]);
        if (phone.length >= 10) {
          leads.push({
            name: nameMatch[1].trim(),
            business_name: nameMatch[1].trim(),
            phone,
            address: addrMatch ? addrMatch[1].trim() : '',
            city,
            profession,
          });
          found++;
        }
      }
    }

    // If structured parsing found nothing, try a broader regex
    if (found === 0) {
      const broadPhoneRegex = /href="tel:([^"]+)"[^>]*>[^<]*<[^>]*>[^<]*<[^>]*>([^<]+)/g;
      while ((match = broadPhoneRegex.exec(html)) !== null && leads.length < maxResults) {
        const phone = cleanPhone(match[1]);
        if (phone.length >= 10) {
          leads.push({
            name: match[2].trim() || 'Inconnu',
            business_name: match[2].trim() || '',
            phone,
            address: '',
            city,
            profession,
          });
        }
      }
    }

    // Check if there's a next page
    if (!html.includes('next') && !html.includes('page-suivante') && !html.includes(`/${page + 1}/`)) {
      break;
    }

    page++;
    if (page > 10) break; // Safety limit
  }

  // Deduplicate by phone
  const seen = new Set<string>();
  return leads.filter((l) => {
    if (seen.has(l.phone)) return false;
    seen.add(l.phone);
    return true;
  });
}
