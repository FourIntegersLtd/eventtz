import assert from "node:assert/strict";
import { test } from "node:test";
import { validateBlogSaveFields } from "@/domains/admin-blog/blogSaveValidation";

test("validateBlogSaveFields accepts a normal draft", () => {
  assert.equal(validateBlogSaveFields({ title: "Summer weddings", subtitle: "Tips", slug: "summer-weddings" }), null);
});

test("validateBlogSaveFields rejects a blank title", () => {
  assert.equal(validateBlogSaveFields({ title: "   " }), "Enter a title.");
});
