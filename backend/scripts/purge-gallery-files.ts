import { purgeGalleryFiles } from '../services/gallery.service';
import { prisma } from '../config/database';
void purgeGalleryFiles().finally(() => prisma.$disconnect());
