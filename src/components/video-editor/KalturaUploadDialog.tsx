import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertCircle, Check, Cloud, ExternalLink, Loader2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useScopedT } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";

interface KalturaUploadDialogProps {
	isOpen: boolean;
	onClose: () => void;
	filePath: string;
	defaultName?: string;
}

interface UploadProgress {
	uploadId: string;
	phase: "uploading" | "processing" | "complete" | "error";
	percentage: number;
	entryId?: string;
	error?: string;
}

export function KalturaUploadDialog({
	isOpen,
	onClose,
	filePath,
	defaultName,
}: KalturaUploadDialogProps) {
	const t = useScopedT("kaltura");
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [tags, setTags] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("none");
	const [categories, setCategories] = useState<
		Array<{ id: number; name: string; fullName: string }>
	>([]);
	const [isLoadingCategories, setIsLoadingCategories] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const currentUploadIdRef = useRef<string | null>(null);

	// Initialize form and load categories
	useEffect(() => {
		if (!isOpen) return;

		setName(
			defaultName ||
				filePath
					.split(/[/\\]/)
					.pop()
					?.replace(/\.[^.]+$/, "") ||
				"Recording",
		);
		setDescription("");
		setTags("");
		setSelectedCategory("none");
		setCategories([]);
		setUploadProgress(null);
		currentUploadIdRef.current = null;
		setUploadError(null);
		setIsUploading(false);

		// Load categories
		setIsLoadingCategories(true);
		window.electronAPI
			.kalturaListCategories()
			.then((result) => {
				if (result.success && result.categories) {
					setCategories(result.categories);
				}
			})
			.finally(() => setIsLoadingCategories(false));
	}, [isOpen, filePath, defaultName]);

	// Listen for upload progress (filtered by uploadId to ignore stale events)
	useEffect(() => {
		if (!isOpen) return;

		const cleanup = window.electronAPI.onKalturaUploadProgress((progress) => {
			if (currentUploadIdRef.current && progress.uploadId !== currentUploadIdRef.current) return;
			if (progress.uploadId) currentUploadIdRef.current = progress.uploadId;
			setUploadProgress(progress);
			if (progress.phase === "complete") {
				setIsUploading(false);
			} else if (progress.phase === "error") {
				setIsUploading(false);
				setUploadError(progress.error || t("upload.failed"));
			}
		});

		return cleanup;
	}, [isOpen, t]);

	const handleUpload = useCallback(async () => {
		if (!name.trim()) return;

		setIsUploading(true);
		setUploadError(null);
		setUploadProgress({ uploadId: "", phase: "uploading", percentage: 0 });

		try {
			const categoryValue = selectedCategory === "none" ? "" : selectedCategory;
			const result = await window.electronAPI.kalturaUpload({
				filePath,
				name: name.trim(),
				description: description.trim() || undefined,
				tags: tags.trim() || undefined,
				categoryIds: categoryValue || undefined,
			});

			if (result.uploadId) currentUploadIdRef.current = result.uploadId;

			if (!result.success) {
				setUploadError(result.error || t("upload.failed"));
				setIsUploading(false);
			}
			// Success is handled by the progress listener (phase: "complete")
		} catch (error) {
			setUploadError(String(error));
			setIsUploading(false);
		}
	}, [filePath, name, description, tags, selectedCategory, t]);

	const isComplete = uploadProgress?.phase === "complete";
	const hasError = uploadProgress?.phase === "error" || uploadError;

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				if (!open && !isUploading) onClose();
			}}
		>
			<DialogPortal>
				<DialogOverlay className="z-[70] backdrop-blur-md" />
				<DialogPrimitive.Content
					onInteractOutside={(e) => {
						if (isUploading) e.preventDefault();
					}}
					className={cn(
						"fixed left-[50%] top-[50%] z-[80] grid w-[90vw] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-0 border p-8 shadow-lg duration-200",
						"data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
						"bg-[#09090b] rounded-2xl shadow-2xl border-white/10",
					)}
				>
					{/* Built-in close X (hidden during upload) */}
					{!isUploading && (
						<DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
							<X className="h-4 w-4" />
							<span className="sr-only">{t("upload.cancel")}</span>
						</DialogPrimitive.Close>
					)}

					{/* Header */}
					<div className="flex items-center gap-3 mb-6">
						<div
							className={`w-10 h-10 rounded-full flex items-center justify-center ring-1 ${
								isComplete
									? "bg-emerald-500/20 ring-emerald-500/50"
									: "bg-orange-500/20 ring-orange-500/50"
							}`}
						>
							{isComplete ? (
								<Check className="w-5 h-5 text-emerald-400" />
							) : (
								<Cloud className="w-5 h-5 text-orange-400" />
							)}
						</div>
						<div>
							<span className="text-lg font-bold text-slate-200 block">
								{isComplete ? t("upload.uploaded") : t("upload.title")}
							</span>
							<span className="text-xs text-slate-500">
								{isComplete
									? t("upload.entryId", { id: uploadProgress?.entryId ?? "" })
									: filePath.split(/[/\\]/).pop()}
							</span>
						</div>
					</div>

					{/* Success State */}
					{isComplete && (
						<div className="text-center py-6 animate-in zoom-in-95">
							<div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4 ring-1 ring-emerald-500/50">
								<Check className="w-8 h-8 text-emerald-400" />
							</div>
							<p className="text-lg text-slate-200 font-medium mb-1">{t("upload.complete")}</p>
							<p className="text-sm text-slate-400">{t("upload.success")}</p>
							{uploadProgress?.entryId && (
								<p className="text-xs text-slate-500 mt-2 font-mono">
									{t("upload.entryId", { id: uploadProgress.entryId })}
								</p>
							)}
							<div className="flex items-center justify-center gap-3 mt-6">
								{uploadProgress?.entryId && (
									<Button
										onClick={() =>
											window.electronAPI.openExternalUrl(
												`https://kmc.kaltura.com/index.php/kmcng/content/entries/entry/${uploadProgress.entryId}/metadata`,
											)
										}
										className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30"
									>
										<ExternalLink className="w-4 h-4 mr-2" />
										{t("upload.openInKaltura")}
									</Button>
								)}
								<Button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-slate-200">
									{t("connection.done")}
								</Button>
							</div>
						</div>
					)}

					{/* Upload Progress */}
					{isUploading && uploadProgress && !isComplete && (
						<div className="space-y-4 py-2">
							<div className="space-y-2">
								<div className="flex justify-between text-xs font-medium text-slate-400 uppercase tracking-wider">
									<span>
										{uploadProgress.phase === "processing"
											? t("upload.processing")
											: t("upload.title")}
									</span>
									<span className="font-mono text-slate-200">{uploadProgress.percentage}%</span>
								</div>
								<div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
									<div
										className="h-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)] transition-all duration-300 ease-out"
										style={{
											width: `${Math.min(uploadProgress.percentage, 100)}%`,
										}}
									/>
								</div>
							</div>
							<p className="text-sm text-slate-400 text-center">
								{uploadProgress.phase === "processing"
									? t("upload.processing")
									: t("upload.uploading")}
							</p>
						</div>
					)}

					{/* Error State */}
					{hasError && !isUploading && !isComplete && (
						<div className="mb-4 animate-in slide-in-from-top-2">
							<div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
								<AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
								<p className="text-sm text-red-400 leading-relaxed">
									{uploadError || uploadProgress?.error || t("upload.failed")}
								</p>
							</div>
						</div>
					)}

					{/* Form (only when not uploading/complete) */}
					{!isUploading && !isComplete && (
						<div className="space-y-4">
							<div>
								<label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">
									{t("upload.titleRequired")}
								</label>
								<Input
									type="text"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder={t("upload.titlePlaceholder")}
									className="bg-white/5 border-white/10 text-sm text-slate-200 placeholder:text-slate-600 focus-visible:ring-orange-500/50 focus-visible:ring-1 focus-visible:ring-offset-0"
								/>
							</div>

							<div>
								<label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">
									{t("upload.description")}
								</label>
								<textarea
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									placeholder={t("upload.descriptionPlaceholder")}
									rows={2}
									className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 resize-none"
								/>
							</div>

							<div>
								<label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">
									{t("upload.tags")}
								</label>
								<Input
									type="text"
									value={tags}
									onChange={(e) => setTags(e.target.value)}
									placeholder={t("upload.tagsPlaceholder")}
									className="bg-white/5 border-white/10 text-sm text-slate-200 placeholder:text-slate-600 focus-visible:ring-orange-500/50 focus-visible:ring-1 focus-visible:ring-offset-0"
								/>
							</div>

							<div>
								<label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">
									{t("upload.category")}
								</label>
								<Select value={selectedCategory} onValueChange={setSelectedCategory}>
									<SelectTrigger className="bg-white/5 border-white/10 text-sm text-slate-200 focus:ring-orange-500/50 focus:ring-1 focus:ring-offset-0 [&>span]:text-slate-200">
										{isLoadingCategories ? (
											<Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
										) : (
											<SelectValue placeholder={t("upload.categoryPlaceholder")} />
										)}
									</SelectTrigger>
									<SelectContent className="bg-[#111] border-white/10 z-[90]">
										<SelectItem value="none" className="text-slate-500">
											{t("upload.categoryNone")}
										</SelectItem>
										{categories.map((cat) => (
											<SelectItem key={cat.id} value={String(cat.id)} className="text-slate-200">
												{cat.fullName}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="flex justify-end gap-3 pt-2">
								<Button
									onClick={onClose}
									variant="ghost"
									className="text-slate-300 hover:text-white hover:bg-white/10"
								>
									{t("upload.cancel")}
								</Button>
								<Button
									onClick={handleUpload}
									disabled={!name.trim()}
									className="bg-orange-500 hover:bg-orange-600 text-white"
								>
									<Upload className="w-4 h-4 mr-2" />
									{t("upload.uploadButton")}
								</Button>
							</div>
						</div>
					)}
				</DialogPrimitive.Content>
			</DialogPortal>
		</Dialog>
	);
}
