// Tiny command line front-end for xBRZ (https://sourceforge.net/projects/xbrz/, GPL-3.0).
// usage: xbrz_cli <in.raw> <width> <height> <factor 2..6> <out.raw>
// in/out: 32-bit pixels, xBRZ RGBA format (0xAARRGGBB as uint32 little-endian = bytes B,G,R,A).
// Used offline only by tools/build_web.py to make the HD sprite set for the web version.
#include "xbrz.cpp"  // single translation unit (the header defines xbrz_scale_defaults non-inline)
#include <cstdio>
#include <cstdlib>
#include <vector>

int main(int argc, char** argv) {
    if (argc != 6) { std::fprintf(stderr, "usage: xbrz_cli in.raw w h factor out.raw\n"); return 2; }
    int w = std::atoi(argv[2]), h = std::atoi(argv[3]), f = std::atoi(argv[4]);
    std::vector<uint32_t> src(size_t(w) * h), dst(size_t(w) * h * f * f);
    FILE* fi = std::fopen(argv[1], "rb");
    if (!fi || std::fread(src.data(), 4, src.size(), fi) != src.size()) { std::fprintf(stderr, "read failed\n"); return 1; }
    std::fclose(fi);
    xbrz_scale_defaults(f, src.data(), dst.data(), w, h, ColorFormat::RGBA);  // ioistired/xbrz.py C API
    FILE* fo = std::fopen(argv[5], "wb");
    if (!fo) return 1;
    std::fwrite(dst.data(), 4, dst.size(), fo);
    std::fclose(fo);
    return 0;
}
