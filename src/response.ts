import { resolve as urlResolve } from 'url';
import * as _ from 'underscore';

export interface CrawlOptions {
  ignoreRelative: boolean;
  shouldCrawl: (link: string) => boolean
}

export interface HttpResponse {
  headers: {
    [headerName: string]: string
  },
  body: {
    toString(encoding: string): string
  },
  statusCode: number,
  request: {
    uri: {
      href: string
    }
  }
}

export default class Response {
  response: HttpResponse

  constructor(response: HttpResponse) {
    this.response = response;
  }

  isTextHtml(): boolean {
    const { response } = this;

    return Boolean(response && response.headers && response.headers['content-type']
      && response.headers['content-type'].match(/^text\/html.*$/));
  }

  getBody(): string {
    if (!this.isTextHtml()) {
      return '<<...binary content (omitted by js-crawler)...>>';
    }

    const { response } = this;
    const defaultEncoding = 'utf8';
    let encoding = defaultEncoding;

    if (response.headers['content-encoding']) {
      encoding = response.headers['content-encoding'];
    }

    let decodedBody: string;
    try {
      decodedBody = response.body.toString(encoding);
    } catch (decodingError) {
      decodedBody = response.body.toString(defaultEncoding);
    }
    return decodedBody;
  }

  stripComments(str: string): string {
    return str.replace(/<!--.*?-->/g, '');
  }

  getBaseUrl(defaultBaseUrl: string, body: string): string {

    /*
     * Resolving the base url following
     * the algorithm from https://www.w3.org/TR/html5/document-metadata.html#the-base-element
     */
    const baseUrlRegex = /<base href="(.*?)">/;
    const baseUrlInPage = body.match(baseUrlRegex);
    if (!baseUrlInPage) {
      return defaultBaseUrl;
    }

    return urlResolve(defaultBaseUrl, baseUrlInPage[1]);
  };

  isLinkProtocolSupported(link: string): boolean {
    return (link.indexOf('://') < 0 && link.indexOf('mailto:') < 0)
      || link.indexOf('http://') >= 0 || link.indexOf('https://') >= 0;
  }

  getAllUrls(defaultBaseUrl: string, body: string, options: CrawlOptions): string[] {
    body = this.stripComments(body);
    const baseUrl = this.getBaseUrl(defaultBaseUrl, body);
    const linksRegex = options.ignoreRelative ? /<a[^>]+?href=["'].*?:\/\/.*?["']/gmi : /<a[^>]+?href=["'].*?["']/gmi;
    const links = body.match(linksRegex) || [];

    //console.log('body = ', body);
    const urls = _.chain(links)
      .map(function(link) {
        const match = /href=[\"\'](.*?)[#\"\']/i.exec(link);

        link = match[1];
        link = urlResolve(baseUrl, link);
        return link;
      })
      .uniq()
      .filter(link => {
        return this.isLinkProtocolSupported(link) && options.shouldCrawl(link);
      })
      .value();

    //console.log('urls to crawl = ', urls);
    return urls;
  };
}