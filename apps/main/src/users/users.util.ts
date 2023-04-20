const usernameTooLong = (username: string): boolean => username.length > 20;

const usernameTooShort = (username: string): boolean => username.length < 3;

const usernameStartsOrEndsWithUnderscore = (username: string): boolean => {
  const trimmed = username.trim();
  if (trimmed[0] === "_" || trimmed[trimmed.length - 1] === "_") {
    return true;
  }
  return false;
};

const usernameHasMoreThanOneUnderscore = (username: string): boolean =>
  username.split("_").length > 2;

const usernameRE = /^[a-zA-Z0-9_]*$/;
const htmlRE = /<[a-z][\s\S]*>/i;

const testHtmlRE = (username: string): boolean => htmlRE.test(username);

const testUsernameRE = (username: string): boolean =>
  username.indexOf(" ") === -1 || usernameRE.test(username);

export const isValidUsername = (username: string): boolean => {
  if (
    usernameTooShort(username) ||
    usernameTooLong(username) ||
    usernameStartsOrEndsWithUnderscore(username) ||
    usernameHasMoreThanOneUnderscore(username) ||
    testHtmlRE(username) ||
    testUsernameRE(username)
  ) {
    return false;
  }
  return true;
};
