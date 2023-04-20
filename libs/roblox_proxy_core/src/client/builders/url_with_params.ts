export class UrlWithParamsBuilder {
  #url: string;
  #params = new URLSearchParams();

  constructor(url: string) {
    this.#url = url;
  }

  param(key: string, value: string) {
    this.#params.set(key, value);
    return this;
  }

  params(params: Record<string, string>) {
    for (const [key, value] of Object.entries(params)) {
      this.#params.set(key, value);
    }
    return this;
  }

  build() {
    const uspString = this.#params.toString();
    return this.#url.includes("?")
      ? `${this.#url}&${uspString}`
      : `${this.#url}?${uspString}`;
  }
}
