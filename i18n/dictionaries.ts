import type { Locale } from "@/i18n/config";

const dictionaries = {
  fr: {
    brandTagline: "La gestion agricole, simplement.",
    nav: {
      home: "Accueil",
      login: "Se connecter",
      signup: "Créer un compte",
      workspace: "Mon espace",
      language: "العربية",
    },
    home: {
      eyebrow: "Pensé pour les agriculteurs tunisiens",
      title: "Gardez votre ferme sous contrôle, sans complication.",
      description:
        "FellahPro rassemblera vos cultures, votre élevage, vos achats, vos ventes et votre stock dans un outil clair et accessible.",
      primaryAction: "Commencer gratuitement",
      secondaryAction: "J’ai déjà un compte",
      featureOne: "Une vue simple de votre exploitation",
      featureTwo: "Des chiffres fiables en dinars tunisiens",
      featureThree: "Disponible en français et en arabe",
    },
    auth: {
      loginTitle: "Bienvenue",
      loginDescription: "Connectez-vous pour accéder à votre espace FellahPro.",
      signupTitle: "Créer votre compte",
      signupDescription: "Quelques informations suffisent pour commencer.",
      fullName: "Nom complet",
      email: "Adresse e-mail",
      password: "Mot de passe",
      passwordHint: "8 caractères minimum",
      loginAction: "Se connecter",
      signupAction: "Créer mon compte",
      noAccount: "Vous n’avez pas encore de compte ?",
      hasAccount: "Vous avez déjà un compte ?",
      logout: "Se déconnecter",
      messages: {
        invalidForm: "Vérifiez les informations saisies.",
        invalidCredentials: "E-mail ou mot de passe incorrect.",
        signupFailed: "Impossible de créer le compte. Réessayez ou utilisez une autre adresse.",
        checkEmail: "Compte créé. Consultez votre e-mail pour confirmer votre adresse.",
        confirmed: "Adresse confirmée. Vous pouvez maintenant vous connecter.",
        confirmationFailed: "Le lien de confirmation est invalide ou a expiré.",
      },
    },
    protected: {
      eyebrow: "Espace sécurisé",
      title: "Votre compte FellahPro est prêt.",
      description:
        "L’authentification fonctionne. La gestion de la ferme arrivera dans la prochaine mission.",
      signedInAs: "Connecté avec",
      noDashboard: "Aucun tableau de bord n’a été ajouté à cette étape.",
    },
  },
  ar: {
    brandTagline: "إدارة فلاحية بكل بساطة.",
    nav: {
      home: "الرئيسية",
      login: "تسجيل الدخول",
      signup: "إنشاء حساب",
      workspace: "فضائي",
      language: "Français",
    },
    home: {
      eyebrow: "مصمّم للفلاحين التونسيين",
      title: "تابع ضيعتك بسهولة ووضوح.",
      description:
        "سيجمع FellahPro الزراعات وتربية الحيوانات والمشتريات والمبيعات والمخزون في أداة واضحة وسهلة الاستعمال.",
      primaryAction: "ابدأ مجانًا",
      secondaryAction: "لدي حساب",
      featureOne: "نظرة بسيطة على ضيعتك",
      featureTwo: "أرقام موثوقة بالدينار التونسي",
      featureThree: "متوفر بالعربية والفرنسية",
    },
    auth: {
      loginTitle: "مرحبًا بك",
      loginDescription: "سجّل الدخول للوصول إلى فضاء FellahPro.",
      signupTitle: "إنشاء حساب",
      signupDescription: "بضع معلومات تكفي للبدء.",
      fullName: "الاسم الكامل",
      email: "البريد الإلكتروني",
      password: "كلمة المرور",
      passwordHint: "8 أحرف على الأقل",
      loginAction: "تسجيل الدخول",
      signupAction: "إنشاء حسابي",
      noAccount: "ليس لديك حساب بعد؟",
      hasAccount: "لديك حساب بالفعل؟",
      logout: "تسجيل الخروج",
      messages: {
        invalidForm: "تحقّق من المعلومات المدخلة.",
        invalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
        signupFailed: "تعذّر إنشاء الحساب. أعد المحاولة أو استعمل عنوانًا آخر.",
        checkEmail: "تم إنشاء الحساب. راجع بريدك لتأكيد العنوان.",
        confirmed: "تم تأكيد العنوان. يمكنك الآن تسجيل الدخول.",
        confirmationFailed: "رابط التأكيد غير صالح أو انتهت صلاحيته.",
      },
    },
    protected: {
      eyebrow: "فضاء آمن",
      title: "حساب FellahPro جاهز.",
      description: "المصادقة تعمل. ستُضاف إدارة الضيعة في المهمة القادمة.",
      signedInAs: "متصل بواسطة",
      noDashboard: "لم تتم إضافة لوحة قيادة في هذه المرحلة.",
    },
  },
} as const;

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}
