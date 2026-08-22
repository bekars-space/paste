import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { getPaste } from "$lib/server/pastes";

const ID = /^[A-Za-z0-9]{8}$/;

export const load: PageServerLoad = async ({ params }) => {
  if (!ID.test(params.id)) error(404, "Paste not found");

  const paste = await getPaste(params.id);
  if (!paste) error(404, "Paste not found");

  return paste;
};
