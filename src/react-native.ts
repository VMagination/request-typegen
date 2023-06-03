import {
  typeGenWrapper as typeGenWMain,
  TGWrapperFn
} from "./index";

export const typeGenWrapper: TGWrapperFn = (
  request,
  config
) => {
  return typeGenWMain(request, config);
}
