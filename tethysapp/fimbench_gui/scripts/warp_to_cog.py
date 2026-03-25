from osgeo import gdal
import argparse
from pathlib import Path

def warp_to_web_cog(src_path: str, dst_path: str) -> str:
    gdal.UseExceptions()
    gdal.SetConfigOption("GDAL_NUM_THREADS", "ALL_CPUS")

    warp_options = gdal.WarpOptions(
        # 🔥 IMPORTANT: your metadata says EPSG:4326, not 5070
        srcSRS="EPSG:4326",
        dstSRS="EPSG:3857",
        resampleAlg="near",
        format="COG",
        creationOptions=[
            "BLOCKSIZE=256",
            "COMPRESS=DEFLATE",
            "BIGTIFF=IF_SAFER",
        ],
        multithread=True,
    )

    ds = gdal.Warp(
        destNameOrDestDS=dst_path,
        srcDSOrSrcDSTab=src_path,
        options=warp_options,
    )

    if ds is None:
        raise RuntimeError(f"gdal.Warp failed for {src_path}")

    ds = None
    return dst_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Warp GeoTIFF → Web Mercator COG")
    parser.add_argument("src", help="Input .tif file")
    parser.add_argument("dst", help="Output .tif (COG) file")

    args = parser.parse_args()

    src = Path(args.src)
    dst = Path(args.dst)

    if not src.exists():
        raise FileNotFoundError(f"Input file not found: {src}")

    dst.parent.mkdir(parents=True, exist_ok=True)

    print(f"Processing:\n  SRC: {src}\n  DST: {dst}")

    warp_to_web_cog(str(src), str(dst))

    print("✅ Done.")