import {
  typeGenWrapper as typeGenWMain,
  TGWrapperFn
} from "./index";

export const typeGenWrapper: TGWrapperFn = (
  request
) => {
  return typeGenWMain(request, {
    enabled: false
  } as any);
}
