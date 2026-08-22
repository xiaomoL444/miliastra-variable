# miliastra-struct

千星奇域结构体定义与结构体变量的零依赖 TypeScript 解析库。保留编辑器可重新导入的原始 JSON，同时提供适合前端渲染的扁平访问方式。

```ts
import { StructWorkspace } from "miliastra-struct";

const workspace = new StructWorkspace();
workspace.importDefinition("1077936130", definitionJson);
workspace.importDefinition("1077936131", childDefinitionJson);

const structValue = workspace.parse(variableJson);
structValue.type;       // 变量实际类型
structValue.defineType; // 定义要求的类型
structValue.name;       // 定义中的类型名

structValue.value.新增变量1.value;
structValue.value.新增变量2.value[0];
structValue.value.新增变量21.value.子字段.value;
structValue.value.新增变量24.value[0].key;
structValue.value.新增变量24.value[0].value;
```

`value` 的形状：普通类型返回原始值，普通列表返回原始数组，`Struct` 返回以字段名为键的对象，`StructList` 返回 `StructValue[]`，`Dict` 返回 `{ key: StructValue; value: StructValue }[]`。

## 类型冲突

```ts
const field = structValue.value.新增变量1;
field.type;
field.defineType;
field.isTypeMatch;
console.log(structValue.issues);
```

冲突时仍保留原始数据。结构体和结构体列表还会比较 `structId`。

### 缺失与多余字段

```ts
for (const warning of structValue.warnings) {
  console.warn(warning.kind, warning.path, warning.message);
}

const missing = structValue.value.缺少字段;
missing.value;      // 已从定义补入的默认值
missing.type;       // ""，变量未提供实际类型
missing.defineType; // 定义要求的类型
missing.isMissing;  // true

const extra = structValue.value["$extra[24]"];
extra.value;   // 多余字段仍可访问
extra.isExtra; // true
```

诊断 `kind` 有 `missing-field`、`extra-field`、`type-mismatch` 和 `struct-id-mismatch`。缺失字段调用 `reset()` 或粘贴兼容值后会成为正常字段；未修复就序列化时，补入节点的 `param_type` 仍为空，方便调用方阻止导出并提示用户。

千星字段只按数组位置保存，没有字段名。因此库能可靠判断定义尾部缺失和变量尾部多余；如果删除的是中间字段且相邻字段类型相同，单凭导出 JSON 无法无歧义还原删除位置。

## 复制、粘贴、重置

```ts
const clipboard = sourceField.copy(); // JSON-safe 深拷贝
targetField.canPaste(clipboard);
targetField.paste(clipboard); // 不兼容时不修改并返回 false
targetField.reset();          // 恢复工作区定义中的默认值
```

字典粘贴还比较键类型、值类型和 `value_structId`。

## 反推回千星格式

```ts
const rawVariable = structValue.toQxqyValue();
const json = structValue.serialize(2);
const rawField = structValue.value.新增变量1.toParamNode();
```

## 批量定义与默认实例

```ts
const workspace = new StructWorkspace({
  "1077936130": rootDefinition,
  "1077936131": childDefinition,
});
workspace.importDefinitions([
  { structId: "1077936132", structDefinition: anotherDefinition },
]);
const fresh = workspace.createDefault("1077936130");
```

## 构建、测试、发布

```bash
cd packages/miliastra-struct
pnpm install
pnpm test
pnpm publish --dry-run --access public
pnpm login
pnpm publish --access public
```

`pnpm publish` 默认会检查当前 Git 分支和工作区是否干净；正式发布前请先提交改动。

不要求先建立新的 Git 项目；可以直接从这个子目录发布。若准备长期维护，推荐把 `packages/miliastra-struct` 单独放进一个公开 Git 仓库，再在 `package.json` 补充 `author`、`repository`、`homepage` 和 `bugs`。

当前包名是 `miliastra-struct`。发布前先在 npm 搜索确认名称可用；如果已被占用，推荐改为个人 scope，例如 `@你的npm用户名/miliastra-struct`。scope 包公开发布时保留 `--access public`。每次再次发布都必须先提升 `version`，已经发布过的同名同版本不能重复使用。
