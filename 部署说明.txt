【Akini 部署到 GitHub Pages 步骤】

1. 解压本压缩包，你会看到 index.html 等文件（共 17 个文件 + 本说明）。
2. 打开你的 GitHub 仓库页面（例如 angel-una/angel-una.github.io）。
3. 点 Add file → Upload files，把解压出来的【所有文件】直接拖进去上传。
   ⚠️ 关键：index.html 必须在仓库最外层！
   打开仓库首页应该能直接看到 index.html，而不是看到一个文件夹。
   ⚠️ 不要上传 zip 压缩包本身，要先解压再传文件。
4. 仓库 Settings → Pages → Source 选择 main 分支、/(root) 目录，保存。
5. 等 1~2 分钟，访问 https://你的用户名.github.io/ 即可。

【如果还是 404，按顺序检查】
① 仓库首页文件列表里能直接看到 index.html 吗？看不到说明传错位置（可能在子文件夹里），删掉重传。
② Settings → Pages 里 Source 是否已选 main / (root)？顶部是否显示 "Your site is live at ..."？
③ 访问的网址是否正确？个人主页仓库是 https://用户名.github.io/（不带仓库名后缀）。
④ 等 2 分钟后用手机浏览器「无痕模式」打开，排除缓存。
