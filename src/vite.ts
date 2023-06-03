import fs from 'vite-plugin-fs/browser';

import {
  typeGenWrapper as typeGenWMain,
  TGWrapperFn
} from "./index";

export const typeGenWrapper: TGWrapperFn = (
  request,
  config
) => {
  return typeGenWMain(request, {
    fileExists: fs.stat,
    readFile: fs.readFile,
    writeFile: fs.writeFile,
    ...config,
  });
}
