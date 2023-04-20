export class RequestBuilder {
  #url?: string;
  #init: RequestInit = {};
  #headers: Record<string, string> = {};

  url(url: string) {
    this.#url = url;
    return this;
  }

  method(method: string) {
    this.#init.method = method;
    return this;
  }

  header(key: string, value: string) {
    this.#headers[key] = value;
    return this;
  }

  headers(headers: Record<string, string>) {
    this.#headers = headers;
    return this;
  }

  body(body: string) {
    this.#init.body = body;
    return this;
  }

  build() {
    if (!this.#url) {
      throw new Error("`url()` must be called before `build()`");
    }
    this.#init.headers = this.#headers;
    return new Request(this.#url, this.#init);
  }
}
