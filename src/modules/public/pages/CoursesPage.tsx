import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { publicCourseService } from "../services/publicCourseService";
import CourseCard from "../components/CourseCard";
import BundleCard from "../components/BundleCard";
import { LANGUAGES, BOARDS } from "@/modules/courses/constants";
import { useCoursesRealtime } from "@/shared/hooks/useCoursesRealtime";
import { supabase } from "@/integrations/supabase/client";

type CatNode = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
};

const slugify = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export default function PublicCoursesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  useCoursesRealtime([["public-courses"]]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [subcategory, setSubcategory] = useState(searchParams.get("subcategory") || "all");
  const [childCategory, setChildCategory] = useState(searchParams.get("child") || "all");
  const [selLangs, setSelLangs] = useState<string[]>(
    (searchParams.get("lang") || "").split(",").filter(Boolean),
  );
  const [selBoards, setSelBoards] = useState<string[]>(
    (searchParams.get("board") || "").split(",").filter(Boolean),
  );
  const [sort, setSort] = useState<"newest" | "price_asc" | "price_desc">("newest");
  const [productType, setProductType] = useState<"all" | "courses" | "bundles">("all");

  useEffect(() => {
    setCategory(searchParams.get("category") || "all");
    setSubcategory(searchParams.get("subcategory") || "all");
    setChildCategory(searchParams.get("child") || "all");
  }, [searchParams]);

  const handleCategoryChange = (v: string) => {
    setCategory(v);
    setSubcategory("all");
    setChildCategory("all");
    const next = new URLSearchParams(searchParams);
    if (v === "all") next.delete("category"); else next.set("category", v);
    next.delete("subcategory");
    next.delete("child");
    setSearchParams(next, { replace: true });
  };
  const handleSubcategoryChange = (v: string) => {
    setSubcategory(v);
    setChildCategory("all");
    const next = new URLSearchParams(searchParams);
    if (v === "all") next.delete("subcategory"); else next.set("subcategory", v);
    next.delete("child");
    setSearchParams(next, { replace: true });
  };
  const handleChildChange = (v: string) => {
    setChildCategory(v);
    const next = new URLSearchParams(searchParams);
    if (v === "all") next.delete("child"); else next.set("child", v);
    setSearchParams(next, { replace: true });
  };

  const { data: allCourses = [], isLoading } = useQuery({
    queryKey: ["public-courses", search, sort],
    queryFn: () => publicCourseService.listPublishedCourses({ search, sort }),
  });

  const { data: allBundles = [], isLoading: bundlesLoading } = useQuery({
    queryKey: ["public-bundles", search, sort],
    queryFn: () => publicCourseService.listPublishedBundles({ search, sort }),
  });

  const { data: catTree = [] } = useQuery({
    queryKey: ["public-course-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_course_categories");
      if (error) throw error;
      return (data as CatNode[]) || [];
    },
    staleTime: 60_000,
  });

  const matchesCat = (val: string | null | undefined, sel: string, node?: CatNode) => {
    if (sel === "all") return true;
    if (!val) return false;
    const s = slugify(val);
    if (s === sel) return true;
    if (node && (slugify(node.name) === s || node.slug === s)) return true;
    return false;
  };

  const topCats = useMemo(() => catTree.filter((c) => !c.parent_id), [catTree]);
  const selectedTop = useMemo(
    () => topCats.find((c) => c.slug === category || slugify(c.name) === category),
    [topCats, category],
  );
  const subCats = useMemo(
    () => (selectedTop ? catTree.filter((c) => c.parent_id === selectedTop.id) : []),
    [catTree, selectedTop],
  );
  const selectedSub = useMemo(
    () => subCats.find((c) => c.slug === subcategory || slugify(c.name) === subcategory),
    [subCats, subcategory],
  );
  const childCats = useMemo(
    () => (selectedSub ? catTree.filter((c) => c.parent_id === selectedSub.id) : []),
    [catTree, selectedSub],
  );

  const courses = allCourses.filter((c: any) => {
    if (!matchesCat(c.category, category, selectedTop)) return false;
    if (!matchesCat(c.subcategory, subcategory, selectedSub)) return false;
    if (childCategory !== "all" && (!c.child_category || slugify(c.child_category) !== childCategory)) return false;
    if (selLangs.length) {
      const arr: string[] = Array.isArray(c.languages) && c.languages.length ? c.languages : (c.language ? [c.language] : []);
      if (!arr.some((l: string) => selLangs.includes(l))) return false;
    }
    if (selBoards.length) {
      const arr: string[] = Array.isArray(c.boards) ? c.boards : [];
      if (!arr.some((b: string) => selBoards.includes(b))) return false;
    }
    return true;
  });

  const countFor = (
    cat: CatNode,
    level: "top" | "sub" | "child",
  ) => {
    const s = cat.slug;
    const n = slugify(cat.name);
    return allCourses.filter((c: any) => {
      const field =
        level === "top" ? c.category : level === "sub" ? c.subcategory : c.child_category;
      if (!field) return false;
      const v = slugify(field);
      return v === s || v === n;
    }).length;
  };

  const categories = topCats.map((c) => ({ slug: c.slug, name: c.name, count: countFor(c, "top") }));
  const subcategories = subCats.map((c) => ({ slug: c.slug, name: c.name, count: countFor(c, "sub") }));
  const childCategories = childCats.map((c) => ({ slug: c.slug, name: c.name, count: countFor(c, "child") }));

  const bundles = allBundles.filter((b: any) => {
    if (!matchesCat(b.category, category, selectedTop)) return false;
    // bundles do not have subcategory/child; hide when those are constrained
    if (subcategory !== "all" || childCategory !== "all") return false;
    return true;
  });

  const showCourses = productType !== "bundles";
  const showBundles = productType !== "courses";
  const visibleCourses = showCourses ? courses : [];
  const visibleBundles = showBundles ? bundles : [];
  const empty = visibleCourses.length === 0 && visibleBundles.length === 0;

  const toggle = (arr: string[], v: string) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-bold">Course catalog</h1>
        <p className="text-muted-foreground mt-2">Explore mentor-led courses across design, engineering, data, and more.</p>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses & bundles…" className="pl-9 h-11 w-64" />
        </div>
        <Select value={productType} onValueChange={(v) => setProductType(v as any)}>
          <SelectTrigger className="h-11 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            <SelectItem value="courses">Courses</SelectItem>
            <SelectItem value="bundles">Bundles</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={handleCategoryChange}>
          <SelectTrigger className="h-11 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>
                {c.name}{c.count ? ` (${c.count})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={subcategory} onValueChange={handleSubcategoryChange} disabled={subcategories.length === 0}>
          <SelectTrigger className="h-11 w-44"><SelectValue placeholder="All subcategories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subcategories</SelectItem>
            {subcategories.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>
                {c.name}{c.count ? ` (${c.count})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={childCategory} onValueChange={handleChildChange} disabled={childCategories.length === 0}>
          <SelectTrigger className="h-11 w-44"><SelectValue placeholder="All child categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All child categories</SelectItem>
            {childCategories.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>
                {c.name}{c.count ? ` (${c.count})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-11">
              Languages{selLangs.length ? ` (${selLangs.length})` : ""}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2">
            <div className="max-h-64 overflow-y-auto space-y-1">
              {LANGUAGES.map((l) => (
                <button
                  key={l}
                  onClick={() => setSelLangs((arr) => toggle(arr, l))}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-muted"
                >
                  <span>{l}</span>
                  {selLangs.includes(l) && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
            {selLangs.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full mt-1" onClick={() => setSelLangs([])}>Clear</Button>
            )}
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-11">
              Boards{selBoards.length ? ` (${selBoards.length})` : ""}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2">
            <div className="max-h-64 overflow-y-auto space-y-1">
              {BOARDS.map((b) => (
                <button
                  key={b}
                  onClick={() => setSelBoards((arr) => toggle(arr, b))}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-muted"
                >
                  <span>{b}</span>
                  {selBoards.includes(b) && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
            {selBoards.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full mt-1" onClick={() => setSelBoards([])}>Clear</Button>
            )}
          </PopoverContent>
        </Popover>
        <Select value={sort} onValueChange={(v) => setSort(v as any)}>
          <SelectTrigger className="h-11 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="price_asc">Price: low to high</SelectItem>
            <SelectItem value="price_desc">Price: high to low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-10">
        {isLoading || bundlesLoading ? (
          <div className="text-sm text-muted-foreground">Loading courses…</div>
        ) : empty ? (
          <div className="text-center py-16 text-muted-foreground">
            {category !== "all"
              ? "No results in this category."
              : "Nothing matches your filters yet."}
          </div>
        ) : (
          <div className="space-y-10">
            {visibleBundles.length > 0 && (
              <section>
                {productType === "all" && visibleCourses.length > 0 && (
                  <h2 className="text-lg font-semibold mb-4">Course bundles</h2>
                )}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {visibleBundles.map((b: any) => <BundleCard key={b.id} bundle={b} />)}
                </div>
              </section>
            )}
            {visibleCourses.length > 0 && (
              <section>
                {productType === "all" && visibleBundles.length > 0 && (
                  <h2 className="text-lg font-semibold mb-4">Courses</h2>
                )}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {visibleCourses.map((c: any) => <CourseCard key={c.id} course={c} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}