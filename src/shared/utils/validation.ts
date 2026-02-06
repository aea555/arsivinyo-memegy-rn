export function validateTitle(title: string) {
  return title.trim().length > 0 && title.length <= 200;
}

export function validateDescription(description: string) {
  return description.length <= 2000;
}
