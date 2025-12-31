<#outputformat "plainText">
<#assign requiredActionsText><#if requiredActions??><#list requiredActions as requiredAction>${msg("requiredAction.${requiredAction}")}<#sep>, </#sep></#list><#else></#if></#assign>
</#outputformat>
<html>
<body style="background-color: #f3f4f6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 40px 0;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden;">
        
        <!-- Header -->
        <div style="background-color: #0f172a; padding: 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 1px;">HEDGETECHS</h1>
        </div>

        <!-- Content -->
        <div style="padding: 40px 32px;">
            <h2 style="color: #111827; margin-top: 0; margin-bottom: 20px; font-size: 20px;">Action Required</h2>
            
            <p style="color: #4b5563; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
                Hello,
            </p>
            
            <p style="color: #4b5563; font-size: 16px; line-height: 1.5; margin-bottom: 32px;">
                We received a request to update your account settings. To ensure the security of your account, please complete the following action: 
                <strong style="color: #27ae60;">${requiredActionsText}</strong>.
            </p>

            <!-- Button -->
            <div style="text-align: center; margin-bottom: 32px;">
                <a href="${link}" style="background-color: #27ae60; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
                    Securely Update Account
                </a>
            </div>

            <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
                This link will expire in <#if linkExpiration??>${linkExpirationFormatter(linkExpiration)}<#else>12 hours</#if>.
            </p>
            
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 24px;">
                If you did not request this change, you can safely ignore this email. No changes will be made to your account.
            </p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                &copy; ${.now?string("yyyy")} Hedgetechs Trading. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>
