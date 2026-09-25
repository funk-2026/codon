package media

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"

	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp" // register WebP decoding
)

// jpegOrientation reads the EXIF orientation tag (1-8) from a JPEG, or 1.
func jpegOrientation(data []byte) int {
	if len(data) < 4 || data[0] != 0xFF || data[1] != 0xD8 {
		return 1
	}
	i := 2
	for i+4 < len(data) {
		if data[i] != 0xFF {
			return 1
		}
		marker := data[i+1]
		if marker == 0xDA { // start of scan
			return 1
		}
		size := int(binary.BigEndian.Uint16(data[i+2 : i+4]))
		if marker == 0xE1 && i+4+size-2 <= len(data) && size > 14 {
			seg := data[i+4 : i+2+size]
			if len(seg) > 14 && string(seg[:4]) == "Exif" {
				return exifOrientation(seg[6:])
			}
		}
		i += 2 + size
	}
	return 1
}

func exifOrientation(tiff []byte) int {
	if len(tiff) < 8 {
		return 1
	}
	var bo binary.ByteOrder
	switch string(tiff[:2]) {
	case "II":
		bo = binary.LittleEndian
	case "MM":
		bo = binary.BigEndian
	default:
		return 1
	}
	off := int(bo.Uint32(tiff[4:8]))
	if off < 8 || off+2 > len(tiff) {
		return 1
	}
	n := int(bo.Uint16(tiff[off : off+2]))
	for k := 0; k < n; k++ {
		e := off + 2 + k*12
		if e+12 > len(tiff) {
			return 1
		}
		if bo.Uint16(tiff[e:e+2]) == 0x0112 {
			v := int(bo.Uint16(tiff[e+8 : e+10]))
			if v >= 1 && v <= 8 {
				return v
			}
			return 1
		}
	}
	return 1
}

// applyOrientation returns img transformed so it displays upright.
func applyOrientation(img image.Image, o int) image.Image {
	if o <= 1 {
		return img
	}
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	swap := o >= 5
	nw, nh := w, h
	if swap {
		nw, nh = h, w
	}
	dst := image.NewNRGBA(image.Rect(0, 0, nw, nh))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			var dx, dy int
			switch o {
			case 2:
				dx, dy = w-1-x, y
			case 3:
				dx, dy = w-1-x, h-1-y
			case 4:
				dx, dy = x, h-1-y
			case 5:
				dx, dy = y, x
			case 6:
				dx, dy = h-1-y, x
			case 7:
				dx, dy = h-1-y, w-1-x
			case 8:
				dx, dy = y, w-1-x
			}
			dst.Set(dx, dy, img.At(b.Min.X+x, b.Min.Y+y))
		}
	}
	return dst
}

func hasAlpha(img image.Image) bool {
	switch m := img.(type) {
	case *image.NRGBA:
		for i := 3; i < len(m.Pix); i += 4 {
			if m.Pix[i] != 255 {
				return true
			}
		}
		return false
	case *image.RGBA:
		for i := 3; i < len(m.Pix); i += 4 {
			if m.Pix[i] != 255 {
				return true
			}
		}
		return false
	case *image.Paletted, *image.NRGBA64, *image.RGBA64:
		b := img.Bounds()
		for y := b.Min.Y; y < b.Max.Y; y++ {
			for x := b.Min.X; x < b.Max.X; x++ {
				if _, _, _, a := img.At(x, y).RGBA(); a != 0xffff {
					return true
				}
			}
		}
	}
	return false
}

// fit scales img down so its longest side is at most max (never up-scales).
func fit(img image.Image, max int) image.Image {
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	if w <= max && h <= max {
		return img
	}
	var nw, nh int
	if w >= h {
		nw, nh = max, h*max/w
	} else {
		nw, nh = w*max/h, max
	}
	if nw < 1 {
		nw = 1
	}
	if nh < 1 {
		nh = 1
	}
	dst := image.NewNRGBA(image.Rect(0, 0, nw, nh))
	xdraw.CatmullRom.Scale(dst, dst.Bounds(), img, b, xdraw.Over, nil)
	return dst
}

// encode writes PNG when the image has transparency (diagrams), else JPEG.
// Re-encoding drops all metadata (EXIF/GPS).
func encode(img image.Image, alpha bool) (data []byte, mime, ext string, err error) {
	var buf bytes.Buffer
	if alpha {
		enc := png.Encoder{CompressionLevel: png.BestSpeed}
		if err = enc.Encode(&buf, img); err != nil {
			return nil, "", "", err
		}
		return buf.Bytes(), "image/png", "png", nil
	}
	// JPEG has no alpha: flatten onto white.
	b := img.Bounds()
	flat := image.NewRGBA(b)
	xdraw.Draw(flat, b, image.NewUniform(color.White), image.Point{}, xdraw.Src)
	xdraw.Draw(flat, b, img, b.Min, xdraw.Over)
	if err = jpeg.Encode(&buf, flat, &jpeg.Options{Quality: 82}); err != nil {
		return nil, "", "", err
	}
	return buf.Bytes(), "image/jpeg", "jpg", nil
}
