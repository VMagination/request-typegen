import fs from 'fs';
import {
  typeGenWrapper as typeGenWMain,
  TGWrapperFn
} from "./index";

export const typeGenWrapper: TGWrapperFn = (
  request,
  config
) => {
  return typeGenWMain(request, {
    fileExists: fs.statSync,
    readFile: fs.readFileSync,
    writeFile: fs.writeFileSync,
    ...config,
  });
}
