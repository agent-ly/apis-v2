import kleur from "kleur";

export const logger = {
  log: (message: string) => console.log(kleur.green(message)),
  debug: (message: string) => console.debug(kleur.gray(message)),
  error: (message: string) => console.error(kleur.red(message)),
};
